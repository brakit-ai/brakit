import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequests, clearRequests } from "../proxy/request-log.js";
import { groupRequestsIntoFlows } from "./flows.js";

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "cache-control": "no-cache",
  });
  res.end(body);
}

export function handleApiRequests(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const method = url.searchParams.get("method");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const limit = parseInt(url.searchParams.get("limit") ?? "500", 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let results = [...getRequests()].reverse(); // newest first

  if (method) {
    results = results.filter((r) => r.method === method.toUpperCase());
  }

  if (status) {
    if (status.endsWith("xx")) {
      const prefix = parseInt(status[0], 10);
      results = results.filter(
        (r) => Math.floor(r.statusCode / 100) === prefix,
      );
    } else {
      const code = parseInt(status, 10);
      results = results.filter((r) => r.statusCode === code);
    }
  }

  if (search) {
    const lower = search.toLowerCase();
    results = results.filter(
      (r) =>
        r.url.toLowerCase().includes(lower) ||
        r.requestBody?.toLowerCase().includes(lower) ||
        r.responseBody?.toLowerCase().includes(lower),
    );
  }

  const total = results.length;
  results = results.slice(offset, offset + limit);

  sendJson(res, 200, { total, requests: results });
}

export function handleApiFlows(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const flows = groupRequestsIntoFlows(getRequests()).reverse(); // newest first
  sendJson(res, 200, { total: flows.length, flows });
}

export function handleApiClear(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  clearRequests();
  sendJson(res, 200, { cleared: true });
}
