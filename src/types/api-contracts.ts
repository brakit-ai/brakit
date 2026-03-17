import type {
  TracedRequest,
  TracedQuery,
  TracedFetch,
  TracedLog,
  TracedError,
  LiveEndpointData,
} from "./index.js";
import type { StatefulIssue } from "./issue-lifecycle.js";

export type TimelineEvent =
  | { type: "fetch"; timestamp: number; data: TracedFetch }
  | { type: "query"; timestamp: number; data: TracedQuery }
  | { type: "log"; timestamp: number; data: TracedLog }
  | { type: "error"; timestamp: number; data: TracedError };

export interface RequestsResponse {
  total: number;
  requests: TracedRequest[];
}

export interface FlowsResponse {
  total: number;
  flows: Array<{ id: string; requests: TracedRequest[] }>;
}

export interface IssuesResponse {
  issues: readonly StatefulIssue[];
}

export interface FindingsResponse {
  total: number;
  findings: readonly StatefulIssue[];
}

export interface TelemetryEntriesResponse<T = unknown> {
  total: number;
  entries: T[];
}

export interface ActivityResponse {
  requestId: string;
  total: number;
  timeline: TimelineEvent[];
  counts: {
    fetches: number;
    logs: number;
    errors: number;
    queries: number;
  };
}

export interface MetricsResponse {
  endpoints: readonly import("./index.js").EndpointMetrics[];
}

export interface LiveMetricsResponse {
  endpoints: LiveEndpointData[];
}

export type SDKEventType = "request" | "db.query" | "fetch" | "log" | "error" | "auth.check";

export interface SDKEvent {
  type: SDKEventType;
  requestId?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SDKIngestPayload {
  _brakit: true;
  version: number;
  sdk?: string;
  events: SDKEvent[];
}
