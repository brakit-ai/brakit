import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { TracedRequest, BrakitConfig } from "../types.js";

const MAX_ENTRIES = 1000;
const requests: TracedRequest[] = [];

type RequestListener = (req: TracedRequest) => void;
const listeners: RequestListener[] = [];

export function onRequest(fn: RequestListener): void {
  listeners.push(fn);
}

export function offRequest(fn: RequestListener): void {
  const idx = listeners.indexOf(fn);
  if (idx !== -1) listeners.splice(idx, 1);
}

export function getRequests(): readonly TracedRequest[] {
  return requests;
}

export function clearRequests(): void {
  requests.length = 0;
}

const STATIC_PATTERNS = [
  /^\/_next\//,
  /\.(?:js|css|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/,
  /^\/favicon/,
  /^\/__nextjs/,
];

export function isStaticPath(urlPath: string): boolean {
  return STATIC_PATTERNS.some((p) => p.test(urlPath));
}

export function flattenHeaders(
  headers: IncomingHttpHeaders,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    flat[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return flat;
}

export interface CaptureInput {
  method: string;
  url: string;
  requestHeaders: IncomingHttpHeaders;
  requestBody: Buffer | null;
  statusCode: number;
  responseHeaders: IncomingHttpHeaders;
  responseBody: Buffer | null;
  responseContentType: string;
  startTime: number;
  config: Pick<BrakitConfig, "maxBodyCapture">;
}

export function captureRequest(input: CaptureInput): TracedRequest {
  const url = input.url;
  const path = url.split("?")[0];

  let requestBodyStr: string | null = null;
  if (input.requestBody && input.requestBody.length > 0) {
    requestBodyStr = input.requestBody
      .subarray(0, input.config.maxBodyCapture)
      .toString("utf-8");
  }

  let responseBodyStr: string | null = null;
  if (input.responseBody && input.responseBody.length > 0) {
    const ct = input.responseContentType;
    if (ct.includes("json") || ct.includes("text") || ct.includes("html")) {
      responseBodyStr = input.responseBody
        .subarray(0, input.config.maxBodyCapture)
        .toString("utf-8");
    }
  }

  const entry: TracedRequest = {
    id: randomUUID(),
    method: input.method,
    url,
    path,
    headers: flattenHeaders(input.requestHeaders),
    requestBody: requestBodyStr,
    statusCode: input.statusCode,
    responseHeaders: flattenHeaders(input.responseHeaders),
    responseBody: responseBodyStr,
    startedAt: input.startTime,
    durationMs: Math.round(performance.now() - input.startTime),
    responseSize: input.responseBody?.length ?? 0,
    isStatic: isStaticPath(path),
  };

  requests.push(entry);
  if (requests.length > MAX_ENTRIES) {
    requests.shift();
  }

  for (const fn of listeners) {
    fn(entry);
  }

  return entry;
}
