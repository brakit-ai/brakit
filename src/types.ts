export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | (string & {});

export type FlatHeaders = Record<string, string>;

export interface TracedRequest {
  id: string;
  method: HttpMethod;
  url: string;
  path: string;
  headers: FlatHeaders;
  requestBody: string | null;
  statusCode: number;
  responseHeaders: FlatHeaders;
  responseBody: string | null;
  startedAt: number;
  durationMs: number;
  responseSize: number;
  isStatic: boolean;
}

export interface DetectedProject {
  framework: "nextjs" | "unknown";
  devCommand: string;
  devBin: string;
  defaultPort: number;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
}

export interface BrakitConfig {
  proxyPort: number;
  targetPort: number;
  showStatic: boolean;
  maxBodyCapture: number;
}

export type RequestCategory =
  | "auth-handshake"
  | "auth-check"
  | "middleware"
  | "server-action"
  | "api-call"
  | "data-fetch"
  | "page-load"
  | "navigation"
  | "polling"
  | "static"
  | "unknown";

export interface LabeledRequest extends TracedRequest {
  label: string;
  category: RequestCategory;
  sourcePage?: string;
  isDuplicate?: boolean;
  pollingCount?: number;
  pollingDurationMs?: number;
}

export interface RequestFlow {
  id: string;
  label: string;
  requests: LabeledRequest[];
  startTime: number;
  totalDurationMs: number;
  hasErrors: boolean;
  warnings: string[];
  sourcePage: string;
  redundancyPct: number;
}

export type RequestListener = (req: TracedRequest) => void;

// Telemetry — base interface for all instrumented events

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

// Performance metrics (persisted across sessions)

export interface SessionMetric {
  sessionId: string;
  startedAt: number;
  avgDurationMs: number;
  p95DurationMs: number;
  requestCount: number;
  errorCount: number;
  avgQueryCount: number;
}

export interface EndpointMetrics {
  endpoint: string;
  sessions: SessionMetric[];
}

export interface MetricsData {
  version: 1;
  endpoints: EndpointMetrics[];
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
