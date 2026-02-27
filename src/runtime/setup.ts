import { setEmitter } from "../instrument/transport.js";
import { setupFetchHook } from "../instrument/hooks/fetch.js";
import { setupConsoleHook } from "../instrument/hooks/console.js";
import { setupErrorHook } from "../instrument/hooks/errors.js";
import { createDefaultRegistry } from "../instrument/adapters/index.js";
import { createDashboardHandler } from "../dashboard/router.js";
import { onRequest } from "../store/request-log.js";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFetchStore,
  defaultLogStore,
  defaultErrorStore,
  defaultQueryStore,
  MetricsStore,
  FileMetricsPersistence,
} from "../store/index.js";
import { FindingStore } from "../store/finding-store.js";
import { AnalysisEngine } from "../analysis/engine.js";
import { createConsoleInsightListener } from "../output/terminal.js";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX, DEFAULT_MAX_BODY_CAPTURE, METRICS_DIR, PORT_FILE } from "../constants/index.js";
import type { TelemetryEvent } from "../types/index.js";
import type { BrakitConfig } from "../types/index.js";
import { health } from "./health.js";
import { installInterceptor, uninstallInterceptor } from "./interceptor.js";

let initialized = false;

export function setup(): void {
  if (initialized) return;
  initialized = true;

  setEmitter(routeEvent);

  setupFetchHook();
  setupConsoleHook();
  setupErrorHook();

  const registry = createDefaultRegistry();
  registry.patchAll(routeEvent);

  const cwd = process.cwd();
  const metricsStore = new MetricsStore(new FileMetricsPersistence(cwd));
  metricsStore.start();

  const findingStore = new FindingStore(cwd);
  findingStore.start();

  const analysisEngine = new AnalysisEngine(metricsStore, findingStore);
  analysisEngine.start();

  const config: BrakitConfig = {
    proxyPort: 0,
    targetPort: 0,
    showStatic: false,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
  };

  const handleDashboard = createDashboardHandler({ metricsStore, analysisEngine, findingStore });

  onRequest((req) => {
    const queries = defaultQueryStore.getByRequest(req.id);
    const fetches = defaultFetchStore.getByRequest(req.id);
    metricsStore.recordRequest(req, {
      queryCount: queries.length,
      queryTimeMs: queries.reduce((s, q) => s + q.durationMs, 0),
      fetchTimeMs: fetches.reduce((s, f) => s + f.durationMs, 0),
    });
  });

  installInterceptor({
    handleDashboard,
    config,
    onFirstRequest(port) {
      // Write port file for MCP server discovery
      const dir = resolve(cwd, METRICS_DIR);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(cwd, PORT_FILE), String(port));

      analysisEngine.onUpdate(createConsoleInsightListener(port, metricsStore));
      process.stdout.write(`  brakit v${VERSION} — http://localhost:${port}${DASHBOARD_PREFIX}\n`);
    },
  });

  health.setTeardown(() => {
    uninstallInterceptor();
    analysisEngine.stop();
    findingStore.stop();
    metricsStore.stop();

    // Remove port file so MCP server knows brakit is no longer running
    try {
      const portPath = resolve(cwd, PORT_FILE);
      if (existsSync(portPath)) unlinkSync(portPath);
    } catch { /* non-critical */ }
  });
}

function routeEvent(event: TelemetryEvent): void {
  switch (event.type) {
    case "fetch":
      defaultFetchStore.add(event.data);
      break;
    case "log":
      defaultLogStore.add(event.data);
      break;
    case "error":
      defaultErrorStore.add(event.data);
      break;
    case "query":
      defaultQueryStore.add(event.data);
      break;
  }
}
