import { subscribe } from "node:diagnostics_channel";
import { randomUUID } from "node:crypto";
import type { TelemetryEvent } from "../../types/index.js";
import { getRequestContext } from "./context.js";
import { NOISE_HOSTS, NOISE_PATH_PATTERNS, BRAKIT_REQUEST_ID_HEADER, BRAKIT_FETCH_ID_HEADER } from "../../constants/index.js";

interface UndiciRequest {
  origin?: string;
  method?: string;
  path?: string;
  host?: string;
  addHeader?(name: string, value: string): void;
}

interface UndiciResponse {
  statusCode?: number;
  headers?: Buffer[];
}

let brakitPort = 0;
export function setBrakitPort(port: number): void { brakitPort = port; }

function isNoise(origin: string, path: string): boolean {
  if (NOISE_PATH_PATTERNS.some((p) => path.includes(p))) return true;
  try {
    const host = new URL(origin).hostname;
    return NOISE_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

const pending = new WeakMap<
  object,
  { origin: string; method: string; path: string; startTime: number; parentRequestId: string; fetchId: string }
>();

export function setupFetchHook(emit: (event: TelemetryEvent) => void): void {
  subscribe("undici:request:create", (message: unknown) => {
    const msg = message as { request: UndiciRequest };
    const req = msg.request;
    const origin = req.origin ?? "";
    const path = req.path ?? "/";
    if (isNoise(origin, path)) return;
    if (brakitPort && origin.includes(`localhost:${brakitPort}`)) return;
    const ctx = getRequestContext();
    if (!ctx) return;
    const fetchId = randomUUID();
    req.addHeader?.(BRAKIT_REQUEST_ID_HEADER, ctx.requestId);
    req.addHeader?.(BRAKIT_FETCH_ID_HEADER, fetchId);
    pending.set(msg.request, {
      origin,
      method: req.method ?? "GET",
      path,
      startTime: performance.now(),
      parentRequestId: ctx.requestId,
      fetchId,
    });
  });

  subscribe("undici:request:headers", (message: unknown) => {
    const msg = message as { request: UndiciRequest; response: UndiciResponse };
    const info = pending.get(msg.request);
    if (!info) return;
    pending.delete(msg.request);

    emit({
      type: "fetch",
      data: {
        fetchId: info.fetchId,
        url: info.origin + info.path,
        method: info.method,
        statusCode: msg.response.statusCode ?? 0,
        durationMs: Math.round(performance.now() - info.startTime),
        parentRequestId: info.parentRequestId,
        timestamp: Date.now(),
      },
    });
  });

  subscribe("undici:request:error", (message: unknown) => {
    const msg = message as { request: UndiciRequest };
    pending.delete(msg.request);
  });
}
