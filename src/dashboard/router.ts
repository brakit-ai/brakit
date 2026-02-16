import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrakitConfig } from "../types.js";
import { handleApiRequests, handleApiFlows, handleApiClear } from "./api.js";
import { handleSSE } from "./sse.js";
import { getDashboardHtml } from "./page.js";

export function isDashboardRequest(url: string): boolean {
  return url === "/__brakit" || url.startsWith("/__brakit/");
}

export function handleDashboardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: BrakitConfig,
): void {
  const url = req.url ?? "/";
  const path = url.split("?")[0];

  if (path === "/__brakit/api/requests") {
    handleApiRequests(req, res);
    return;
  }

  if (path === "/__brakit/api/events") {
    handleSSE(req, res);
    return;
  }

  if (path === "/__brakit/api/flows") {
    handleApiFlows(req, res);
    return;
  }

  if (path === "/__brakit/api/clear") {
    handleApiClear(req, res);
    return;
  }

  // Serve the dashboard SPA for all other /__brakit paths
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
  });
  res.end(getDashboardHtml(config));
}
