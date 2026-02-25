import http from "node:http";
import { randomUUID } from "node:crypto";
import { requestContextStorage, type RequestContext } from "../instrument/hooks/context.js";
import { setEmitter } from "../instrument/transport.js";
import { setupFetchHook } from "../instrument/hooks/fetch.js";
import { setupConsoleHook } from "../instrument/hooks/console.js";
import { setupErrorHook } from "../instrument/hooks/errors.js";
import { createDefaultRegistry } from "../instrument/adapters/index.js";
import { createDashboardHandler, isDashboardRequest } from "../dashboard/router.js";
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
import { safeWrap } from "./safe-wrap.js";
import { health } from "./health.js";
import { isLocalRequest } from "./guard.js";
import { captureInProcess } from "./capture.js";

let initialized = false;

export function setup(): void {
  if (initialized) return;
  initialized = true;

  // Route telemetry events directly to stores
  setEmitter(routeEvent);

  // Set up instrumentation hooks
  setupFetchHook();
  setupConsoleHook();
  setupErrorHook();

  const registry = createDefaultRegistry();
  registry.patchAll(routeEvent);

  // Stores + analysis
  const cwd = process.cwd();
  const metricsStore = new MetricsStore(new FileMetricsPersistence(cwd));
  metricsStore.start();

  const analysisEngine = new AnalysisEngine();
  analysisEngine.start();

  // Mutable config — port is set once the server starts listening
  const config: BrakitConfig = {
    proxyPort: 0,
    targetPort: 0,
    showStatic: false,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
  };

  const handleDashboard = createDashboardHandler({ metricsStore, analysisEngine });

  // Track requests in metrics store
  onRequest((req) => {
    const queryCount = defaultQueryStore.getByRequest(req.id).length;
    metricsStore.recordRequest(req, queryCount);
  });

  // Patch http.Server.prototype.emit — intercept all requests
  const originalEmit = http.Server.prototype.emit as (
    event: string | symbol,
    ...args: unknown[]
  ) => boolean;
  let bannerPrinted = false;

  (http.Server.prototype as { emit: typeof originalEmit }).emit = safeWrap(
    originalEmit,
    function (original, event: string | symbol, ...args: unknown[]): boolean {
      if (event !== "request") return original.apply(this, [event, ...args]);

      const req = args[0] as http.IncomingMessage;
      const res = args[1] as http.ServerResponse;
      const url = req.url ?? "/";

      // Detect port from first request and print banner
      if (!bannerPrinted) {
        const port = req.socket.localPort;
        if (port) {
          bannerPrinted = true;
          config.proxyPort = port;
          analysisEngine.onUpdate(createConsoleInsightListener(port, metricsStore));
          console.log(`  brakit v${VERSION} — http://localhost:${port}${DASHBOARD_PREFIX}`);
        }
      }

      // Serve dashboard to localhost only
      if (isDashboardRequest(url)) {
        if (!isLocalRequest(req)) {
          res.writeHead(404);
          res.end("Not Found");
          return true;
        }
        handleDashboard(req, res, config);
        return true;
      }

      // Set up request context + capture
      const requestId = randomUUID();
      const ctx: RequestContext = {
        requestId,
        url,
        method: req.method ?? "GET",
      };

      captureInProcess(req, res, requestId);

      return requestContextStorage.run(ctx, () =>
        original.apply(this, [event, ...args]),
      );
    },
  );

  // Register teardown for circuit breaker
  health.setTeardown(() => {
    (http.Server.prototype as { emit: typeof originalEmit }).emit = originalEmit;
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
