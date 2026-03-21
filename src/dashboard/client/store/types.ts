/**
 * Dashboard client types.
 *
 * These mirror the server-side types but represent the JSON shapes received
 * from the dashboard API. The server types live in src/types/ and include
 * Node.js-specific concerns; these are the browser-side equivalents.
 */

// ---------------------------------------------------------------------------
// Shared enums — keep in sync with src/types/telemetry.ts
// ---------------------------------------------------------------------------

export type DbDriver =
  | "pg"
  | "mysql2"
  | "prisma"
  | "asyncpg"
  | "sqlalchemy"
  | "sdk";
export type LogLevel = "log" | "warn" | "error" | "info" | "debug";
export type NormalizedOp = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";
export type IssueState = "open" | "fixing" | "resolved" | "stale" | "regressed";
export type IssueCategory = "security" | "performance" | "reliability";
export type AiFixStatus = "fixed" | "wont_fix";

// ---------------------------------------------------------------------------
// Global config injected by the server into the HTML page.
// ---------------------------------------------------------------------------

export interface BrakitClientConfig {
  port: number;
  version: string;
}

declare global {
  interface Window {
    __BRAKIT_CONFIG__: BrakitClientConfig;
  }
}

// ---------------------------------------------------------------------------
// Core traced data shapes (API response types)
// ---------------------------------------------------------------------------

export interface TracedRequest {
  id: string;
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  requestBody: string | null;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  startedAt: number;
  durationMs: number;
  responseSize: number;
  isStatic: boolean;
  isHealthCheck?: boolean;
  category?: string;
  label?: string;
  isDuplicate?: boolean;
  isStrictModeDupe?: boolean;
  pollingCount?: number;
  pollingDurationMs?: number;
}

export interface TracedFetch {
  id: string;
  parentRequestId: string | null;
  fetchId?: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
}

export interface TracedQuery {
  id: string;
  parentRequestId: string | null;
  parentFetchId?: string;
  sql?: string;
  normalizedOp?: NormalizedOp;
  operation?: string;
  table?: string;
  model?: string;
  durationMs: number;
  timestamp: number;
  rowCount?: number;
  driver: DbDriver;
  source?: string;
}

export interface TracedLog {
  id: string;
  parentRequestId: string | null;
  level: LogLevel;
  message: string;
  args?: unknown[];
  timestamp: number;
}

export interface TracedError {
  id: string;
  parentRequestId: string | null;
  name: string;
  message: string;
  stack?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Flow & analysis
// ---------------------------------------------------------------------------

export interface RequestFlow {
  id: string;
  label: string;
  requests: TracedRequest[];
  startTime: number;
  totalDurationMs: number;
  hasErrors: boolean;
  warnings: string[];
  sourcePage: string;
  redundancyPct: number;
}

export interface FlowRequest extends TracedRequest {
  label: string;
  isDuplicate?: boolean;
  isStrictModeDupe?: boolean;
  pollingDurationMs?: number;
}

export interface FlowData {
  label: string;
  requests: FlowRequest[];
  totalDurationMs: number;
  hasErrors: boolean;
  redundancyPct: number;
}

export interface FlowInsight {
  successes: string[];
  errors: string[];
  warnings: string[];
  duplicates: { name: string; count: number; wastedMs: number }[];
  tip: string;
}

// ---------------------------------------------------------------------------
// Issues / Security
// ---------------------------------------------------------------------------

export interface StatefulIssue {
  issueId: string;
  state: IssueState;
  source: string;
  category: IssueCategory;
  issue: {
    type: string;
    severity: string;
    title: string;
    desc: string;
    hint: string;
    endpoint: string;
    detail?: string;
    nav?: string;
    rule?: string;
    count?: number;
  };
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt: number | null;
  occurrences: number;
  cleanHitsSinceLastSeen: number;
  aiStatus: AiFixStatus | null;
  aiNotes: string | null;
}

export interface GroupedIssue {
  rule: string;
  title: string;
  severity: string;
  hint: string;
  items: StatefulIssue[];
}

// ---------------------------------------------------------------------------
// Metrics / Performance
// ---------------------------------------------------------------------------

export interface MetricDataPoint {
  ts: number;
  p50: number;
  p95: number;
  count: number;
  errorRate: number;
  queryCount?: number;
  queryTimeMs?: number;
  fetchTimeMs?: number;
}

export interface EndpointMetrics {
  endpoint: string;
  data: MetricDataPoint[];
}

export interface LiveRequestPoint {
  timestamp: number;
  durationMs: number;
  statusCode: number;
  queryCount: number;
  queryTimeMs: number;
  fetchTimeMs: number;
}

export interface LiveEndpointSummary {
  p95Ms: number;
  medianMs: number;
  errorRate: number;
  avgQueryCount: number;
  totalRequests: number;
  avgQueryTimeMs: number;
  avgFetchTimeMs: number;
  avgAppTimeMs: number;
}

export interface LiveEndpointData {
  endpoint: string;
  requests: LiveRequestPoint[];
  summary: LiveEndpointSummary;
  sessions?: SessionMetric[];
  baselineP95Ms: number | null;
}

export interface SessionMetric {
  sessionId: string;
  startedAt: number;
  avgDurationMs: number;
  p95DurationMs: number;
  requestCount: number;
  errorCount: number;
  avgQueryCount: number;
  avgQueryTimeMs: number;
  avgFetchTimeMs: number;
}

// ---------------------------------------------------------------------------
// Fetch groups (fetches-view aggregation)
// ---------------------------------------------------------------------------

export interface FetchGroup {
  method: string;
  url: string;
  count: number;
  totalDur: number;
  maxDur: number;
  errors: number;
  callers: Record<string, number>;
  statusCodes: Record<number, number>;
  firstTs: number;
  lastTs: number;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineCounts {
  queries: number;
  fetches: number;
  logs: number;
  errors: number;
}

export type TimelineEvent =
  | { type: "fetch"; timestamp: number; data: TracedFetch }
  | { type: "query"; timestamp: number; data: TracedQuery }
  | { type: "log"; timestamp: number; data: TracedLog }
  | { type: "error"; timestamp: number; data: TracedError };

export interface TimelineData {
  total: number;
  counts: TimelineCounts;
  timeline: TimelineEvent[];
}

/** Response from the batch activity API (?requestIds=...). */
export interface FlowActivityData {
  requestIds: string[];
  activities: Record<string, TimelineData>;
}

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export type ViewMode = "simple" | "detailed";

export type StoreStateKey =
  | "flows"
  | "requests"
  | "fetches"
  | "errors"
  | "logs"
  | "queries"
  | "issues"
  | "metrics"
  | "viewMode"
  | "activeView"
  | "all";

export interface DashboardState {
  flows: RequestFlow[];
  requests: TracedRequest[];
  fetches: TracedFetch[];
  errors: TracedError[];
  logs: TracedLog[];
  queries: TracedQuery[];
  issues: StatefulIssue[];
  metrics: EndpointMetrics[];
  viewMode: ViewMode;
  activeView: string;
}
