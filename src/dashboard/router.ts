import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrakitConfig } from "../types.js";
import {
  DASHBOARD_PREFIX,
  DASHBOARD_API_REQUESTS,
  DASHBOARD_API_EVENTS,
  DASHBOARD_API_FLOWS,
  DASHBOARD_API_CLEAR,
  DASHBOARD_API_LOGS,
  DASHBOARD_API_FETCHES,
  DASHBOARD_API_ERRORS,
  DASHBOARD_API_INGEST,
} from "../constants.js";
import {
  handleApiRequests,
  handleApiFlows,
  handleApiClear,
  handleApiLogs,
  handleApiFetches,
  handleApiErrors,
  handleApiIngest,
} from "./api.js";
import { handleSSE } from "./sse.js";
import { getDashboardHtml } from "./page.js";

export function isDashboardRequest(url: string): boolean {
  return url === DASHBOARD_PREFIX || url.startsWith(DASHBOARD_PREFIX + "/");
}

export function handleDashboardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: BrakitConfig,
): void {
  const url = req.url ?? "/";
  const path = url.split("?")[0];

  if (path === DASHBOARD_API_REQUESTS) {
    handleApiRequests(req, res);
    return;
  }

  if (path === DASHBOARD_API_EVENTS) {
    handleSSE(req, res);
    return;
  }

  if (path === DASHBOARD_API_FLOWS) {
    handleApiFlows(req, res);
    return;
  }

  if (path === DASHBOARD_API_CLEAR) {
    handleApiClear(req, res);
    return;
  }

  if (path === DASHBOARD_API_LOGS) {
    handleApiLogs(req, res);
    return;
  }

  if (path === DASHBOARD_API_FETCHES) {
    handleApiFetches(req, res);
    return;
  }

  if (path === DASHBOARD_API_ERRORS) {
    handleApiErrors(req, res);
    return;
  }

  if (path === DASHBOARD_API_INGEST) {
    handleApiIngest(req, res);
    return;
  }

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
  });
  res.end(getDashboardHtml(config));
}
