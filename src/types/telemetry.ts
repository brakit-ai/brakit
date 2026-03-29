import type { DbDriver, LogLevel, NormalizedOp, SourceLocation } from "./shared.js";

export interface TelemetryEntry {
  id: string;
  parentRequestId: string | null;
  timestamp: number;
}

export interface TracedFetch extends TelemetryEntry {
  fetchId?: string;
  url: string;
  method: string;
  statusCode: number;
  durationMs: number;
  callSite?: SourceLocation;
}

export interface TracedLog extends TelemetryEntry {
  level: LogLevel;
  message: string;
}

export interface TracedError extends TelemetryEntry {
  name: string;
  message: string;
  stack?: string;
}

export interface TracedQuery extends TelemetryEntry {
  driver: DbDriver;
  sql?: string;
  model?: string;
  operation?: string;
  durationMs: number;
  rowCount?: number;
  normalizedOp?: NormalizedOp;
  table?: string;
  source?: string;
  parentFetchId?: string;
  callSite?: SourceLocation;
}

export type TelemetryEvent =
  | { type: "fetch"; data: Omit<TracedFetch, "id"> }
  | { type: "log"; data: Omit<TracedLog, "id"> }
  | { type: "error"; data: Omit<TracedError, "id"> }
  | { type: "query"; data: Omit<TracedQuery, "id"> };

export type TelemetryBatch = {
  _brakit: true;
  events: TelemetryEvent[];
};
