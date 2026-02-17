import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrakitConfig } from "../types/index.js";
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
} from "../constants.js";
import {
  handleApiRequests,
  handleApiFlows,
  handleApiClear,
  handleApiLogs,
  handleApiFetches,
  handleApiErrors,
  handleApiQueries,
  handleApiMetrics,
  handleApiIngest,
} from "./api/index.js";
import { handleSSE } from "./sse.js";
import { getDashboardHtml } from "./page.js";

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void;

const routes: Record<string, RouteHandler> = {
  [DASHBOARD_API_REQUESTS]: handleApiRequests,
  [DASHBOARD_API_EVENTS]: handleSSE,
  [DASHBOARD_API_FLOWS]: handleApiFlows,
  [DASHBOARD_API_CLEAR]: handleApiClear,
  [DASHBOARD_API_LOGS]: handleApiLogs,
  [DASHBOARD_API_FETCHES]: handleApiFetches,
  [DASHBOARD_API_ERRORS]: handleApiErrors,
  [DASHBOARD_API_QUERIES]: handleApiQueries,
  [DASHBOARD_API_METRICS]: handleApiMetrics,
  [DASHBOARD_API_INGEST]: handleApiIngest,
};

export function isDashboardRequest(url: string): boolean {
  return url === DASHBOARD_PREFIX || url.startsWith(DASHBOARD_PREFIX + "/");
}

export function handleDashboardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: BrakitConfig,
): void {
  const path = (req.url ?? "/").split("?")[0];
  const handler = routes[path];

  if (handler) {
    handler(req, res);
    return;
  }

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
  });
  res.end(getDashboardHtml(config));
}
