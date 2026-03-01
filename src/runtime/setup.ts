import { setupFetchHook } from "../instrument/hooks/fetch.js";
import { setupConsoleHook } from "../instrument/hooks/console.js";
import { setupErrorHook } from "../instrument/hooks/errors.js";
import { createDefaultRegistry } from "../instrument/adapters/index.js";
import { createDashboardHandler } from "../dashboard/router.js";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { EventBus } from "../core/event-bus.js";
import { ServiceRegistry } from "../core/service-registry.js";
import { RequestStore } from "../store/request-store.js";
import { FetchStore } from "../store/fetch-store.js";
import { LogStore } from "../store/log-store.js";
import { ErrorStore } from "../store/error-store.js";
import { QueryStore } from "../store/query-store.js";
import { MetricsStore, FileMetricsPersistence } from "../store/index.js";
import { FindingStore } from "../store/finding-store.js";
import { AnalysisEngine } from "../analysis/engine.js";
import { startTerminalInsights } from "../output/terminal.js";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX, DEFAULT_MAX_BODY_CAPTURE, METRICS_DIR, PORT_FILE } from "../constants/index.js";
import type { TelemetryEvent, BrakitConfig } from "../types/index.js";
import type { ChannelMap } from "../core/event-bus.js";
import { health } from "./health.js";
import { installInterceptor, uninstallInterceptor } from "./interceptor.js";

let initialized = false;

export function setup(): void {
  if (initialized) return;
  initialized = true;

  const bus = new EventBus();
  const registry = new ServiceRegistry();

  const requestStore = new RequestStore();
  const fetchStore = new FetchStore();
  const logStore = new LogStore();
  const errorStore = new ErrorStore();
  const queryStore = new QueryStore();

  registry.register("event-bus", bus);
  registry.register("request-store", requestStore);
  registry.register("fetch-store", fetchStore);
  registry.register("log-store", logStore);
  registry.register("error-store", errorStore);
  registry.register("query-store", queryStore);

  // Bus → stores: incoming telemetry events get routed to their stores
  bus.on("telemetry:fetch", (data) => fetchStore.add(data));
  bus.on("telemetry:query", (data) => queryStore.add(data));
  bus.on("telemetry:log", (data) => logStore.add(data));
  bus.on("telemetry:error", (data) => errorStore.add(data));

  // Store → bus: when a request is captured, emit on the bus
  requestStore.onRequest((req) => bus.emit("request:completed", req));

  // Telemetry emit callback for hooks and adapters
  const telemetryEmit = (event: TelemetryEvent): void => {
    const channel = `telemetry:${event.type}` as keyof ChannelMap;
    bus.emit(channel, event.data as ChannelMap[typeof channel]);
  };

  setupFetchHook(telemetryEmit);
  setupConsoleHook(telemetryEmit);
  setupErrorHook(telemetryEmit);

  const adapterRegistry = createDefaultRegistry();
  adapterRegistry.patchAll(telemetryEmit);

  const cwd = process.cwd();
  const metricsStore = new MetricsStore(new FileMetricsPersistence(cwd));
  metricsStore.start();
  registry.register("metrics-store", metricsStore);

  const findingStore = new FindingStore(cwd);
  findingStore.start();
  registry.register("finding-store", findingStore);

  const analysisEngine = new AnalysisEngine(registry);
  analysisEngine.start();
  registry.register("analysis-engine", analysisEngine);

  // Record metrics for each completed request
  bus.on("request:completed", (req) => {
    const queries = queryStore.getByRequest(req.id);
    const fetches = fetchStore.getByRequest(req.id);
    metricsStore.recordRequest(req, {
      queryCount: queries.length,
      queryTimeMs: queries.reduce((s, q) => s + q.durationMs, 0),
      fetchTimeMs: fetches.reduce((s, f) => s + f.durationMs, 0),
    });
  });

  const config: BrakitConfig = {
    proxyPort: 0,
    targetPort: 0,
    showStatic: false,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
  };

  const handleDashboard = createDashboardHandler(registry);

  let terminalDispose: (() => void) | null = null;

  installInterceptor({
    handleDashboard,
    config,
    requestStore,
    onFirstRequest(port) {
      const dir = resolve(cwd, METRICS_DIR);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(cwd, PORT_FILE), String(port));

      terminalDispose = startTerminalInsights(registry, port);
      process.stdout.write(`  brakit v${VERSION} — http://localhost:${port}${DASHBOARD_PREFIX}\n`);
    },
  });

  health.setTeardown(() => {
    uninstallInterceptor();
    terminalDispose?.();
    analysisEngine.stop();
    findingStore.stop();
    metricsStore.stop();

    try {
      const portPath = resolve(cwd, PORT_FILE);
      if (existsSync(portPath)) unlinkSync(portPath);
    } catch { /* non-critical */ }
  });
}
