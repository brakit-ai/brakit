import { subscribe } from "node:diagnostics_channel";
import type { TelemetryEvent } from "../../types/index.js";
import { getRequestContext } from "./context.js";
import { NOISE_HOSTS } from "../../constants/index.js";

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

function isNoise(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return NOISE_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

const pending = new WeakMap<
  object,
  { origin: string; method: string; path: string; startTime: number; parentRequestId: string | null }
>();

export function setupFetchHook(emit: (event: TelemetryEvent) => void): void {
  subscribe("undici:request:create", (message: unknown) => {
    const msg = message as { request: UndiciRequest };
    const req = msg.request;
    const origin = req.origin ?? "";
    if (isNoise(origin)) return;
    const ctx = getRequestContext();
    pending.set(msg.request, {
      origin,
      method: req.method ?? "GET",
      path: req.path ?? "/",
      startTime: performance.now(),
      parentRequestId: ctx?.requestId ?? null,
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
