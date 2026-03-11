import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReadonlyTelemetryStore } from "../../store/index.js";
import { LOCALHOST_HOSTNAMES, SENSITIVE_HEADER_NAMES, URL_PARSE_BASE } from "../../constants/index.js";
import { SENSITIVE_MASK_MIN_LENGTH, SENSITIVE_MASK_VISIBLE_CHARS, MAX_JSON_BODY_BYTES, SENSITIVE_MASK_PLACEHOLDER } from "../../constants/limits.js";
import { HTTP_OK, HTTP_BAD_REQUEST, HTTP_METHOD_NOT_ALLOWED, HTTP_PAYLOAD_TOO_LARGE } from "../../constants/http.js";

export function maskSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      const s = String(value);
      masked[key] = s.length <= SENSITIVE_MASK_MIN_LENGTH
        ? SENSITIVE_MASK_PLACEHOLDER
        : s.slice(0, SENSITIVE_MASK_VISIBLE_CHARS) + "..." + s.slice(-SENSITIVE_MASK_VISIBLE_CHARS);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export function getCorsOrigin(req: IncomingMessage): string {
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
    sendJson(req, res, HTTP_METHOD_NOT_ALLOWED, { error: "Method not allowed" });
    return false;
  }
  return true;
}

export function parseRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", URL_PARSE_BASE);
}

export function readJsonBody(
  req: IncomingMessage,
  res: ServerResponse,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        sendJson(req, res, HTTP_PAYLOAD_TOO_LARGE, { error: "Payload too large" });
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > maxBytes) { resolve(null); return; }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        sendJson(req, res, HTTP_BAD_REQUEST, { error: "Invalid JSON body" });
        resolve(null);
      }
    });
    req.on("error", () => {
      resolve(null);
    });
  });
}

export function handleTelemetryGet(
  req: IncomingMessage,
  res: ServerResponse,
  store: ReadonlyTelemetryStore,
): void {
  if (!requireGet(req, res)) return;
  const url = parseRequestUrl(req);
  const requestId = url.searchParams.get("requestId");
  const entries = requestId
    ? store.getByRequest(requestId)
    : [...store.getAll()];
  sendJson(req, res, HTTP_OK, { total: entries.length, entries: entries.reverse() });
}
