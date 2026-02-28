import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrakitConfig } from "../types/index.js";
import type { MetricsStore } from "../store/index.js";
import type { AnalysisEngine } from "../analysis/engine.js";
import type { FindingStore } from "../store/finding-store.js";
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
} from "../constants/index.js";
import {
  handleApiRequests,
  handleApiFlows,
  createClearHandler,
  handleApiLogs,
  handleApiFetches,
  handleApiErrors,
  handleApiQueries,
  handleApiIngest,
  createMetricsHandler,
  createLiveMetricsHandler,
  handleApiActivity,
} from "./api/index.js";
import { createInsightsHandler, createSecurityHandler } from "./api/insights.js";
import { createFindingsHandler } from "./api/findings.js";
import { createSSEHandler } from "./sse.js";
import { getDashboardHtml } from "./page.js";
import { recordTabViewed, recordDashboardOpened, isTelemetryEnabled } from "../telemetry/index.js";

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

const VALID_TABS = new Set([
  "overview", "actions", "requests", "fetches",
  "queries", "errors", "logs", "performance", "security",
]);

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
} as const;

export function isDashboardRequest(url: string): boolean {
  return url === DASHBOARD_PREFIX || url.startsWith(DASHBOARD_PREFIX + "/");
}

export interface DashboardDeps {
  metricsStore: MetricsStore;
  analysisEngine?: AnalysisEngine;
  findingStore?: FindingStore;
}

export function createDashboardHandler(
  deps: DashboardDeps,
): (req: IncomingMessage, res: ServerResponse, config: BrakitConfig) => void {
  const routes: Record<string, RouteHandler> = {
    [DASHBOARD_API_REQUESTS]: handleApiRequests,
    [DASHBOARD_API_EVENTS]: createSSEHandler(deps.analysisEngine),
    [DASHBOARD_API_FLOWS]: handleApiFlows,
    [DASHBOARD_API_CLEAR]: createClearHandler(deps.metricsStore, deps.findingStore),
    [DASHBOARD_API_LOGS]: handleApiLogs,
    [DASHBOARD_API_FETCHES]: handleApiFetches,
    [DASHBOARD_API_ERRORS]: handleApiErrors,
    [DASHBOARD_API_QUERIES]: handleApiQueries,
    [DASHBOARD_API_METRICS]: createMetricsHandler(deps.metricsStore),
    [DASHBOARD_API_METRICS_LIVE]: createLiveMetricsHandler(deps.metricsStore),
    [DASHBOARD_API_INGEST]: handleApiIngest,
    [DASHBOARD_API_ACTIVITY]: handleApiActivity,
  };

  if (deps.analysisEngine) {
    routes[DASHBOARD_API_INSIGHTS] = createInsightsHandler(deps.analysisEngine);
    routes[DASHBOARD_API_SECURITY] = createSecurityHandler(deps.analysisEngine);
  }

  if (deps.findingStore) {
    routes[DASHBOARD_API_FINDINGS] = createFindingsHandler(deps.findingStore);
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
