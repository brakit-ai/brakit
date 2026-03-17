/** Dashboard state types — all interfaces for data flowing through the store. */

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
// Core traced data shapes
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

/** Keep in sync with src/types/telemetry.ts (server types). */
export interface TracedQuery {
  id: string;
  parentRequestId: string | null;
  parentFetchId?: string;
  sql?: string;
  normalizedOp?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";
  operation?: string;
  table?: string;
  model?: string;
  durationMs: number;
  timestamp: number;
  rowCount?: number;
  driver: "pg" | "mysql2" | "prisma" | "asyncpg" | "sqlalchemy" | "sdk";
  source?: string;
}

/** Keep in sync with src/types/telemetry.ts (server types). */
export interface TracedLog {
  id: string;
  parentRequestId: string | null;
  level: "log" | "warn" | "error" | "info" | "debug";
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

/** Extended request shape returned by the flows API (adds label + duplicate info). */
export interface FlowRequest extends TracedRequest {
  label: string;
  isDuplicate?: boolean;
  isStrictModeDupe?: boolean;
  pollingDurationMs?: number;
}

/** Flow data as returned from the API. */
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
  state: "open" | "fixing" | "resolved" | "stale" | "regressed";
  source: string;
  category: "security" | "performance" | "reliability";
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
  aiStatus: "fixed" | "wont_fix" | null;
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

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

export type StoreStateKey =
  | "flows" | "requests" | "fetches" | "errors"
  | "logs" | "queries" | "issues" | "metrics"
  | "viewMode" | "activeView" | "all";

export interface DashboardState {
  flows: RequestFlow[];
  requests: TracedRequest[];
  fetches: TracedFetch[];
  errors: TracedError[];
  logs: TracedLog[];
  queries: TracedQuery[];
  issues: StatefulIssue[];
  metrics: EndpointMetrics[];
  viewMode: "simple" | "detailed";
  activeView: string;
}
