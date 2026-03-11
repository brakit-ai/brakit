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
  DASHBOARD_API_FINDINGS_REPORT,
  MAX_TAB_NAME_LENGTH,
  VALID_TABS,
} from "../constants/index.js";
import {
  HTTP_OK,
  HTTP_NO_CONTENT,
  SECURITY_HEADERS,
} from "../constants/http.js";
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
import {
  createInsightsHandler,
  createSecurityHandler,
} from "./api/insights.js";
import {
  createFindingsHandler,
  createFindingsReportHandler,
} from "./api/findings.js";
import { createSSEHandler } from "./sse.js";
import { getDashboardHtml } from "./page.js";
import {
  recordTabViewed,
  recordDashboardOpened,
  isTelemetryEnabled,
} from "../telemetry/index.js";

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

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
    const findingStore = registry.get("finding-store");
    routes[DASHBOARD_API_FINDINGS] = createFindingsHandler(findingStore);
    routes[DASHBOARD_API_FINDINGS_REPORT] = createFindingsReportHandler(
      findingStore,
      registry.get("event-bus"),
      analysisEngine,
    );
  }

  routes[DASHBOARD_API_TAB] = (req, res) => {
    const raw = (req.url ?? "").split("tab=")[1];
    if (raw) {
      const tab = decodeURIComponent(raw).slice(0, MAX_TAB_NAME_LENGTH);
      if (VALID_TABS.has(tab) && isTelemetryEnabled()) recordTabViewed(tab);
    }
    res.writeHead(HTTP_NO_CONTENT);
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
    res.writeHead(HTTP_OK, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      ...SECURITY_HEADERS,
    });
    res.end(getDashboardHtml(config));
  };
}
