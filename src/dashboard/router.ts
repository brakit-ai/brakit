import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrakitConfig } from "../types/index.js";
import type { ServiceRegistry } from "../core/service-registry.js";
import {
  DASHBOARD_PREFIX,
  DASHBOARD_API_REQUESTS,
  DASHBOARD_API_EVENTS,
  DASHBOARD_API_FLOWS,
  DASHBOARD_API_CLEAR,
  DASHBOARD_API_LOGS,
  DASHBOARD_API_FETCHES,
  DASHBOARD_API_ERRORS,
  DASHBOARD_API_QUERIES,
  DASHBOARD_API_INGEST,
  DASHBOARD_API_METRICS,
  DASHBOARD_API_METRICS_LIVE,
  DASHBOARD_API_ACTIVITY,
  DASHBOARD_API_INSIGHTS,
  DASHBOARD_API_SECURITY,
  DASHBOARD_API_TAB,
  DASHBOARD_API_FINDINGS,
  MAX_TAB_NAME_LENGTH,
  VALID_TABS,
} from "../constants/index.js";
import {
  createRequestsHandler,
  createFlowsHandler,
  createClearHandler,
  createFetchesHandler,
  createLogsHandler,
  createErrorsHandler,
  createQueriesHandler,
  createIngestHandler,
  createMetricsHandler,
  createLiveMetricsHandler,
  createActivityHandler,
} from "./api/index.js";
import { createInsightsHandler, createSecurityHandler } from "./api/insights.js";
import { createFindingsHandler } from "./api/findings.js";
import { createSSEHandler } from "./sse.js";
import { getDashboardHtml } from "./page.js";
import { recordTabViewed, recordDashboardOpened, isTelemetryEnabled } from "../telemetry/index.js";

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:",
} as const;

export function isDashboardRequest(url: string): boolean {
  return url === DASHBOARD_PREFIX || url.startsWith(DASHBOARD_PREFIX + "/");
}

export function createDashboardHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse, config: BrakitConfig) => void {
  const metricsStore = registry.get("metrics-store");
  const analysisEngine = registry.has("analysis-engine")
    ? registry.get("analysis-engine")
    : undefined;

  const routes: Record<string, RouteHandler> = {
    [DASHBOARD_API_REQUESTS]: createRequestsHandler(registry),
    [DASHBOARD_API_EVENTS]: createSSEHandler(registry),
    [DASHBOARD_API_FLOWS]: createFlowsHandler(registry),
    [DASHBOARD_API_CLEAR]: createClearHandler(registry),
    [DASHBOARD_API_LOGS]: createLogsHandler(registry),
    [DASHBOARD_API_FETCHES]: createFetchesHandler(registry),
    [DASHBOARD_API_ERRORS]: createErrorsHandler(registry),
    [DASHBOARD_API_QUERIES]: createQueriesHandler(registry),
    [DASHBOARD_API_METRICS]: createMetricsHandler(metricsStore),
    [DASHBOARD_API_METRICS_LIVE]: createLiveMetricsHandler(metricsStore),
    [DASHBOARD_API_INGEST]: createIngestHandler(registry),
    [DASHBOARD_API_ACTIVITY]: createActivityHandler(registry),
  };

  if (analysisEngine) {
    routes[DASHBOARD_API_INSIGHTS] = createInsightsHandler(analysisEngine);
    routes[DASHBOARD_API_SECURITY] = createSecurityHandler(analysisEngine);
  }

  if (registry.has("finding-store")) {
    routes[DASHBOARD_API_FINDINGS] = createFindingsHandler(registry.get("finding-store"));
  }

  routes[DASHBOARD_API_TAB] = (req, res) => {
    const raw = (req.url ?? "").split("tab=")[1];
    if (raw) {
      const tab = decodeURIComponent(raw).slice(0, MAX_TAB_NAME_LENGTH);
      if (VALID_TABS.has(tab) && isTelemetryEnabled()) recordTabViewed(tab);
    }
    res.writeHead(204);
    res.end();
  };

  return (req, res, config) => {
    const path = (req.url ?? "/").split("?")[0];
    const handler = routes[path];

    if (handler) {
      handler(req, res);
      return;
    }

    if (isTelemetryEnabled()) recordDashboardOpened();
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      ...SECURITY_HEADERS,
    });
    res.end(getDashboardHtml(config));
  };
}
