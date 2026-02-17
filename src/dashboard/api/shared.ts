import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReadonlyTelemetryStore } from "../../store/index.js";

export const JSON_RESPONSE_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "cache-control": "no-cache",
} as const;

export function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown,
): void {
  res.writeHead(status, JSON_RESPONSE_HEADERS);
  res.end(JSON.stringify(data));
}

export function requireGet(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}

export function handleTelemetryGet(
  req: IncomingMessage,
  res: ServerResponse,
  store: ReadonlyTelemetryStore,
): void {
  if (!requireGet(req, res)) return;
  const url = new URL(req.url ?? "/", "http://localhost");
  const requestId = url.searchParams.get("requestId");
  const entries = requestId
    ? store.getByRequest(requestId)
    : [...store.getAll()];
  sendJson(res, 200, { total: entries.length, entries: entries.reverse() });
}
