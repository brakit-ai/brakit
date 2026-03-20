import { randomUUID } from "node:crypto";
import type { TracedRequest, HttpMethod, NormalizedOp } from "../../types/index.js";
import type { TracedFetch, TracedLog, TracedError, TracedQuery, TelemetryEntry } from "../../types/telemetry.js";
import type { SDKEvent } from "../../types/api-contracts.js";
import { isString, isNumber, isBoolean } from "../../utils/type-guards.js";
import {
  SDK_EVENT_DB_QUERY, SDK_EVENT_FETCH, SDK_EVENT_LOG, SDK_EVENT_ERROR,
  SDK_EVENT_REQUEST, SDK_EVENT_AUTH_CHECK,
} from "../../constants/labels.js";
import { isHealthCheckPath } from "../../utils/static-patterns.js";

type OmitId<T extends TelemetryEntry> = Omit<T, "id">;

function str(val: unknown, fallback: string): string {
  return isString(val) ? val : fallback;
}

function strOrUndef(val: unknown): string | undefined {
  return isString(val) ? val : undefined;
}

function num(val: unknown, fallback: number): number {
  return isNumber(val) ? val : fallback;
}

function numOrUndef(val: unknown): number | undefined {
  return isNumber(val) ? val : undefined;
}

function headers(val: unknown): Record<string, string> {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === "string") result[k] = v;
    }
    return result;
  }
  return {};
}

export function parseQueryEvent(
  data: Record<string, unknown>,
  ts: number,
  parentRequestId: string | null,
): OmitId<TracedQuery> {
  return {
    driver: str(data.source ?? data.driver, "sdk") as TracedQuery["driver"],
    source: strOrUndef(data.source ?? data.driver),
    sql: strOrUndef(data.sql),
    model: strOrUndef(data.model),
    operation: strOrUndef(data.operation),
    normalizedOp: (strOrUndef(data.normalizedOp) ?? strOrUndef(data.operation) ?? "OTHER") as NormalizedOp,
    table: str(data.table, ""),
    durationMs: num(data.duration, num(data.durationMs, 0)),
    rowCount: numOrUndef(data.rowCount),
    parentRequestId,
    parentFetchId: strOrUndef(data.parentFetchId ?? data.parent_fetch_id),
    timestamp: ts,
  };
}

export function parseFetchEvent(
  data: Record<string, unknown>,
  ts: number,
  parentRequestId: string | null,
): OmitId<TracedFetch> {
  return {
    fetchId: strOrUndef(data.fetchId ?? data.fetch_id),
    url: str(data.url, ""),
    method: str(data.method, "GET"),
    statusCode: num(data.statusCode, 0),
    durationMs: num(data.duration, num(data.durationMs, 0)),
    parentRequestId,
    timestamp: ts,
  };
}

const LOG_LEVEL_MAP: Record<string, TracedLog["level"]> = {
  debug: "debug",
  info: "info",
  warning: "warn",
  warn: "warn",
  error: "error",
  critical: "error",
  log: "log",
};

export function parseLogEvent(
  data: Record<string, unknown>,
  ts: number,
  parentRequestId: string | null,
): OmitId<TracedLog> {
  return {
    level: LOG_LEVEL_MAP[str(data.level, "log")] ?? "log",
    message: str(data.message, ""),
    parentRequestId,
    timestamp: ts,
  };
}

export function parseErrorEvent(
  data: Record<string, unknown>,
  ts: number,
  parentRequestId: string | null,
): OmitId<TracedError> {
  return {
    name: str(data.name, "Error"),
    message: str(data.message, ""),
    stack: str(data.stack, ""),
    parentRequestId,
    timestamp: ts,
  };
}

export function parseAuthEvent(
  data: Record<string, unknown>,
  ts: number,
  parentRequestId: string | null,
): OmitId<TracedLog> {
  return {
    level: "info",
    message: `[auth] ${str(data.provider, "unknown")}: ${str(data.result, "check")}`,
    parentRequestId,
    timestamp: ts,
  };
}

export function parseRequestEvent(
  data: Record<string, unknown>,
  ts: number,
): TracedRequest {
  const url = str(data.url, "");
  return {
    id: str(data.id, randomUUID()),
    method: str(data.method, "GET") as HttpMethod,
    url,
    path: url.split("?")[0],
    headers: headers(data.headers),
    requestBody: isString(data.requestBody) ? data.requestBody : null,
    statusCode: num(data.statusCode, 200),
    responseHeaders: headers(data.responseHeaders),
    responseBody: isString(data.responseBody) ? data.responseBody : null,
    startedAt: ts,
    durationMs: num(data.durationMs, 0),
    responseSize: num(data.responseSize, 0),
    isStatic: isBoolean(data.isStatic) ? data.isStatic : false,
    isHealthCheck: isBoolean(data.isHealthCheck) ? data.isHealthCheck : isHealthCheckPath(url.split("?")[0]),
  };
}

export function routeSDKEvent(
  event: SDKEvent,
  stores: {
    addQuery: (data: OmitId<TracedQuery>) => void;
    addFetch: (data: OmitId<TracedFetch>) => void;
    addLog: (data: OmitId<TracedLog>) => void;
    addError: (data: OmitId<TracedError>) => void;
    addRequest: (data: TracedRequest) => void;
  },
): void {
  const ts = event.timestamp || Date.now();
  const parentRequestId = event.requestId ?? null;

  switch (event.type) {
    case SDK_EVENT_DB_QUERY:
      stores.addQuery(parseQueryEvent(event.data, ts, parentRequestId));
      break;
    case SDK_EVENT_FETCH:
      stores.addFetch(parseFetchEvent(event.data, ts, parentRequestId));
      break;
    case SDK_EVENT_LOG:
      stores.addLog(parseLogEvent(event.data, ts, parentRequestId));
      break;
    case SDK_EVENT_ERROR:
      stores.addError(parseErrorEvent(event.data, ts, parentRequestId));
      break;
    case SDK_EVENT_AUTH_CHECK:
      stores.addLog(parseAuthEvent(event.data, ts, parentRequestId));
      break;
    case SDK_EVENT_REQUEST:
      stores.addRequest(parseRequestEvent(event.data, ts));
      break;
    default:
      // Silently ignore unknown event types for forward compatibility.
      break;
  }
}
