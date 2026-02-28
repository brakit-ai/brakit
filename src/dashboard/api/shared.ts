import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReadonlyTelemetryStore } from "../../store/index.js";
import { LOCALHOST_HOSTNAMES, SENSITIVE_HEADER_NAMES } from "../../constants/index.js";
import { SENSITIVE_MASK_MIN_LENGTH, SENSITIVE_MASK_VISIBLE_CHARS } from "../../constants/limits.js";

export function maskSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      const s = String(value);
      masked[key] = s.length <= SENSITIVE_MASK_MIN_LENGTH
        ? "****"
        : s.slice(0, SENSITIVE_MASK_VISIBLE_CHARS) + "..." + s.slice(-SENSITIVE_MASK_VISIBLE_CHARS);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

function getCorsOrigin(req: IncomingMessage): string {
  const origin = req.headers.origin ?? "";
  try {
    const url = new URL(origin);
    if (LOCALHOST_HOSTNAMES.has(url.hostname)) {
      return origin;
    }
  } catch {
    // invalid origin — same-origin requests have no Origin header
  }
  return "";
}

function getJsonHeaders(req: IncomingMessage): Record<string, string> {
  const corsOrigin = getCorsOrigin(req);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": "no-cache",
  };
  if (corsOrigin) {
    headers["access-control-allow-origin"] = corsOrigin;
  }
  return headers;
}

export function sendJson(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  data: Record<string, unknown>,
): void {
  res.writeHead(status, getJsonHeaders(req));
  res.end(JSON.stringify(data));
}

export function requireGet(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (req.method !== "GET") {
    sendJson(req, res, 405, { error: "Method not allowed" });
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
  sendJson(req, res, 200, { total: entries.length, entries: entries.reverse() });
}
