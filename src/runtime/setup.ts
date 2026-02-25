import { setEmitter } from "../instrument/transport.js";
import { setupFetchHook } from "../instrument/hooks/fetch.js";
import { setupConsoleHook } from "../instrument/hooks/console.js";
import { setupErrorHook } from "../instrument/hooks/errors.js";
import { createDefaultRegistry } from "../instrument/adapters/index.js";
import { createDashboardHandler } from "../dashboard/router.js";
import { onRequest } from "../store/request-log.js";
import {
  defaultFetchStore,
  defaultLogStore,
  defaultErrorStore,
  defaultQueryStore,
  MetricsStore,
  FileMetricsPersistence,
} from "../store/index.js";
import { AnalysisEngine } from "../analysis/engine.js";
import { createConsoleInsightListener } from "../output/terminal.js";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX, DEFAULT_MAX_BODY_CAPTURE } from "../constants/index.js";
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

  const analysisEngine = new AnalysisEngine(metricsStore);
  analysisEngine.start();

  const config: BrakitConfig = {
    proxyPort: 0,
    targetPort: 0,
    showStatic: false,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
  };

  const handleDashboard = createDashboardHandler({ metricsStore, analysisEngine });

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
      analysisEngine.onUpdate(createConsoleInsightListener(port, metricsStore));
      process.stdout.write(`  brakit v${VERSION} — http://localhost:${port}${DASHBOARD_PREFIX}\n`);
    },
  });

  health.setTeardown(() => {
    uninstallInterceptor();
    analysisEngine.stop();
    metricsStore.stop();
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
