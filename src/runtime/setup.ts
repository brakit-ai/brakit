import { setupFetchHook, setBrakitPort } from "../instrument/hooks/fetch.js";
import { setupConsoleHook } from "../instrument/hooks/console.js";
import { setupErrorHook } from "../instrument/hooks/errors.js";
import { createDefaultRegistry } from "../instrument/adapters/index.js";
import { createDashboardHandler } from "../dashboard/router.js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { EventBus } from "../core/event-bus.js";
import { ServiceRegistry } from "../core/service-registry.js";
import { RequestStore } from "../store/request-store.js";
import { FetchStore } from "../store/fetch-store.js";
import { LogStore } from "../store/log-store.js";
import { ErrorStore } from "../store/error-store.js";
import { QueryStore } from "../store/query-store.js";
import { MetricsStore, FileMetricsPersistence } from "../store/index.js";
import { IssueStore } from "../store/issue-store.js";
import { AnalysisEngine } from "../analysis/engine.js";
import { startTerminalInsights } from "../output/terminal.js";
import { VERSION } from "../index.js";
import {
  DASHBOARD_PREFIX,
  DEFAULT_MAX_BODY_CAPTURE,
  METRICS_DIR,
  PORT_FILE,
} from "../constants/index.js";
import type {
  TelemetryEvent,
  BrakitConfig,
  Framework,
} from "../types/index.js";
import type { ChannelMap } from "../core/event-bus.js";
import { health } from "./health.js";
import { installInterceptor, uninstallInterceptor } from "./interceptor.js";
import { brakitDebug } from "../utils/log.js";
import { getErrorMessage } from "../utils/type-guards.js";
import { getProjectDataDir } from "../utils/fs.js";
import {
  detectFrameworkFromDeps,
  detectPackageManagerSync,
} from "../detect/project.js";
import {
  initSession,
  trackSession,
  recordRequestCount,
  recordInsightTypes,
  recordRulesTriggered,
} from "../telemetry/index.js";

let initPromise: Promise<void> | null = null;

export function setup(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = doSetup();
  return initPromise;
}

async function doSetup(): Promise<void> {
  brakitDebug(`[setup] doSetup called at ${new Date().toISOString()}`);

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

  bus.on("telemetry:fetch", (data) => fetchStore.add(data));
  bus.on("telemetry:query", (data) => queryStore.add(data));
  bus.on("telemetry:log", (data) => logStore.add(data));
  bus.on("telemetry:error", (data) => errorStore.add(data));

  requestStore.onRequest((req) => bus.emit("request:completed", req));

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

  let framework: Framework = "unknown";
  try {
    const pkg = JSON.parse(
      await readFile(resolve(cwd, "package.json"), "utf-8"),
    );
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    framework = detectFrameworkFromDeps(allDeps);
  } catch {
    /* no package.json */
  }

  initSession(
    framework,
    detectPackageManagerSync(cwd),
    false,
    adapterRegistry.getActive().map((a) => a.name),
  );

  const dataDir = getProjectDataDir(cwd);

  const metricsStore = new MetricsStore(new FileMetricsPersistence(dataDir));
  metricsStore.start();
  registry.register("metrics-store", metricsStore);

  const issueStore = new IssueStore(dataDir);
  issueStore.start();
  registry.register("issue-store", issueStore);

  const analysisEngine = new AnalysisEngine(registry);
  analysisEngine.start();
  registry.register("analysis-engine", analysisEngine);

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
      setBrakitPort(port);

      brakitDebug(`[setup] onFirstRequest fired, port=${port}`);

      void (async () => {
        try {
          const dir = resolve(cwd, METRICS_DIR);
          await mkdir(dir, { recursive: true });

          const portPath = resolve(cwd, PORT_FILE);
          try {
            const old = await readFile(portPath, "utf-8");
            if (old.trim() === String(port)) {
              brakitDebug(`[setup] port file already correct, skipping write`);
              return;
            }
            if (old.trim()) {
              brakitDebug(
                `Overwriting stale port file (was ${old.trim()}, now ${port})`,
              );
            }
          } catch {
            brakitDebug(`[setup] no existing port file, will create`);
          }
          await writeFile(portPath, String(port));
          brakitDebug(`[setup] wrote port file: ${portPath}`);
        } catch (err) {
          brakitDebug(`port file write failed: ${getErrorMessage(err)}`);
        }
      })();

      terminalDispose = startTerminalInsights(registry, port);
      process.stdout.write(
        `  brakit v${VERSION} — http://localhost:${port}${DASHBOARD_PREFIX}\n`,
      );
    },
  });

  let telemetrySent = false;
  const sendTelemetry = (): void => {
    if (telemetrySent) return;
    telemetrySent = true;
    recordRequestCount(requestStore.getAll().length);
    recordInsightTypes(analysisEngine.getInsights().map((i) => i.type));
    recordRulesTriggered(analysisEngine.getFindings().map((f) => f.rule));
    trackSession(registry);
  };

  let teardownCalled = false;
  const runTeardown = (): void => {
    if (teardownCalled) return;
    teardownCalled = true;

    sendTelemetry();
    uninstallInterceptor();
    terminalDispose?.();
    analysisEngine.stop();
    issueStore.stop();
    metricsStore.stop();

    try {
      const portPath = resolve(cwd, PORT_FILE);
      if (existsSync(portPath)) unlinkSync(portPath);
    } catch (err) {
      brakitDebug(`[setup] port file cleanup failed: ${getErrorMessage(err)}`);
    }
  };

  health.setTeardown(runTeardown);

  // Send telemetry while async operations still work (before 'exit').
  process.on("beforeExit", () => {
    sendTelemetry();
  });
  // Run full teardown on exit — only sync code runs here, which is fine
  // because runTeardown is fully synchronous. Do NOT call process.exit()
  // — let the host app control its own shutdown lifecycle.
  process.on("exit", () => {
    runTeardown();
  });
}
