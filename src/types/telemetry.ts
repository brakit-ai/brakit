export interface TelemetryEntry {
  id: string;
  parentRequestId: string | null;
  timestamp: number;
}

export interface TracedFetch extends TelemetryEntry {
  url: string;
  method: string;
  statusCode: number;
  durationMs: number;
}

export interface TracedLog extends TelemetryEntry {
  level: "log" | "warn" | "error" | "info" | "debug";
  message: string;
}

export interface TracedError extends TelemetryEntry {
  name: string;
  message: string;
  stack: string;
}

export interface TracedQuery extends TelemetryEntry {
  driver: "pg" | "mysql2" | "prisma" | string;
  sql?: string;
  model?: string;
  operation?: string;
  durationMs: number;
  rowCount?: number;
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
