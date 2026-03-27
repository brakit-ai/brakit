import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrakitConfig } from "../types/index.js";
import { stripQueryString } from "../utils/endpoint.js";
import type { Services } from "../core/services.js";
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
  DASHBOARD_API_GRAPH,
  MAX_TAB_NAME_LENGTH,
  VALID_TABS,
} from "../constants/index.js";
import {
  HTTP_OK,
  HTTP_NO_CONTENT,
  SECURITY_HEADERS,
} from "../constants/labels.js";
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
  createIssuesHandler,
  createFindingsHandler,
  createIssuesReportHandler,
} from "./api/issues.js";
import { createGraphHandler } from "./api/graph.js";
import { createSSEHandler } from "./sse.js";
import { getDashboardHtml } from "./page.js";
import {
  recordTabViewed,
  recordDashboardOpened,
  recordGraphFeature,
  isTelemetryEnabled,
} from "../telemetry/index.js";

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

export function isDashboardRequest(url: string): boolean {
  return url === DASHBOARD_PREFIX || url.startsWith(DASHBOARD_PREFIX + "/");
}

export function createDashboardHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse, config: BrakitConfig) => void {
  const metricsStore = services.metricsStore;

  const routes: Record<string, RouteHandler> = {
    [DASHBOARD_API_REQUESTS]: createRequestsHandler(services),
    [DASHBOARD_API_EVENTS]: createSSEHandler(services),
    [DASHBOARD_API_FLOWS]: createFlowsHandler(services),
    [DASHBOARD_API_CLEAR]: createClearHandler(services),
    [DASHBOARD_API_LOGS]: createLogsHandler(services),
    [DASHBOARD_API_FETCHES]: createFetchesHandler(services),
    [DASHBOARD_API_ERRORS]: createErrorsHandler(services),
    [DASHBOARD_API_QUERIES]: createQueriesHandler(services),
    [DASHBOARD_API_METRICS]: createMetricsHandler(metricsStore),
    [DASHBOARD_API_METRICS_LIVE]: createLiveMetricsHandler(metricsStore),
    [DASHBOARD_API_INGEST]: createIngestHandler(services),
    [DASHBOARD_API_ACTIVITY]: createActivityHandler(services),
  };

  const issueStore = services.issueStore;
  routes[DASHBOARD_API_INSIGHTS] = createIssuesHandler(issueStore);
  routes[DASHBOARD_API_SECURITY] = createIssuesHandler(issueStore);
  routes[DASHBOARD_API_FINDINGS] = createFindingsHandler(issueStore);
  routes[DASHBOARD_API_FINDINGS_REPORT] = createIssuesReportHandler(
    issueStore,
    services.bus,
  );

  routes[DASHBOARD_API_GRAPH] = createGraphHandler(services);

  routes[DASHBOARD_API_TAB] = (req, res) => {
    if (isTelemetryEnabled()) {
      const url = new URL(req.url ?? "/", "http://localhost");
      const tab = url.searchParams.get("tab");
      if (tab && tab.length <= MAX_TAB_NAME_LENGTH && VALID_TABS.has(tab)) {
        recordTabViewed(tab);
      }
      const event = url.searchParams.get("event");
      if (event && event.length <= MAX_TAB_NAME_LENGTH) {
        const detail = url.searchParams.get("detail") ?? undefined;
        recordGraphFeature(event, detail?.slice(0, MAX_TAB_NAME_LENGTH));
      }
    }
    res.writeHead(HTTP_NO_CONTENT);
    res.end();
  };

  return (req, res, config) => {
    const path = stripQueryString(req.url ?? "/");
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
