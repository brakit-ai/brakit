import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequests, clearRequests } from "../proxy/request-log.js";
import { groupRequestsIntoFlows } from "../analysis/group.js";
import { defaultFetchStore } from "../store/fetch-store.js";
import { defaultLogStore } from "../store/log-store.js";
import { defaultErrorStore } from "../store/error-store.js";
import { defaultQueryStore } from "../store/query-store.js";
import { DEFAULT_API_LIMIT } from "../constants.js";
import type { TelemetryBatch, TelemetryEvent } from "../types.js";

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
  const limit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_API_LIMIT), 10);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let results = [...getRequests()].reverse();

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

  const flows = groupRequestsIntoFlows(getRequests()).reverse();
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
  defaultFetchStore.clear();
  defaultLogStore.clear();
  defaultErrorStore.clear();
  defaultQueryStore.clear();
  sendJson(res, 200, { cleared: true });
}

export function handleApiFetches(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const requestId = url.searchParams.get("requestId");
  let entries = requestId
    ? defaultFetchStore.getByRequest(requestId)
    : [...defaultFetchStore.getAll()];
  entries = entries.reverse();
  sendJson(res, 200, { total: entries.length, entries });
}

export function handleApiLogs(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const requestId = url.searchParams.get("requestId");
  let entries = requestId
    ? defaultLogStore.getByRequest(requestId)
    : [...defaultLogStore.getAll()];
  entries = entries.reverse();
  sendJson(res, 200, { total: entries.length, entries });
}

export function handleApiErrors(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const requestId = url.searchParams.get("requestId");
  let entries = requestId
    ? defaultErrorStore.getByRequest(requestId)
    : [...defaultErrorStore.getAll()];
  entries = entries.reverse();
  sendJson(res, 200, { total: entries.length, entries });
}

export function handleApiQueries(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const requestId = url.searchParams.get("requestId");
  let entries = requestId
    ? defaultQueryStore.getByRequest(requestId)
    : [...defaultQueryStore.getAll()];
  entries = entries.reverse();
  sendJson(res, 200, { total: entries.length, entries });
}

function isBrakitBatch(msg: unknown): msg is TelemetryBatch {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "_brakit" in msg &&
    (msg as TelemetryBatch)._brakit === true
  );
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

export function handleApiIngest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (!isBrakitBatch(body)) {
        sendJson(res, 400, { error: "Invalid batch" });
        return;
      }
      for (const event of body.events) {
        routeEvent(event);
      }
      res.writeHead(204);
      res.end();
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
    }
  });
}
