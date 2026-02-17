import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { TracedRequest, BrakitConfig, FlatHeaders, RequestListener } from "../types.js";
import { MAX_REQUEST_ENTRIES } from "../constants.js";

const STATIC_PATTERNS = [
  /^\/_next\//,
  /\.(?:js|css|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/,
  /^\/favicon/,
  /^\/__nextjs/,
];

export function isStaticPath(urlPath: string): boolean {
  return STATIC_PATTERNS.some((p) => p.test(urlPath));
}

export function flattenHeaders(headers: IncomingHttpHeaders): FlatHeaders {
  const flat: FlatHeaders = {};
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

export class RequestStore {
  private requests: TracedRequest[] = [];
  private listeners: RequestListener[] = [];

  constructor(private maxEntries = MAX_REQUEST_ENTRIES) {}

  capture(input: CaptureInput): TracedRequest {
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

    this.requests.push(entry);
    if (this.requests.length > this.maxEntries) {
      this.requests.shift();
    }

    for (const fn of this.listeners) {
      fn(entry);
    }

    return entry;
  }

  getAll(): readonly TracedRequest[] {
    return this.requests;
  }

  clear(): void {
    this.requests.length = 0;
  }

  onRequest(fn: RequestListener): void {
    this.listeners.push(fn);
  }

  offRequest(fn: RequestListener): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
}

export const defaultStore = new RequestStore();

export const captureRequest = (input: CaptureInput) => defaultStore.capture(input);
export const getRequests = () => defaultStore.getAll();
export const clearRequests = () => defaultStore.clear();
export const onRequest = (fn: RequestListener) => defaultStore.onRequest(fn);
export const offRequest = (fn: RequestListener) => defaultStore.offRequest(fn);
