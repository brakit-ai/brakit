import type {
  TracedRequest,
  TracedQuery,
  TracedFetch,
  LiveEndpointData,
} from "./index.js";
import type { StatefulInsight } from "./insight-lifecycle.js";
import type { StatefulFinding } from "./finding-lifecycle.js";

export interface TimelineEvent {
  type: "fetch" | "log" | "error" | "query";
  timestamp: number;
  data: Record<string, unknown>;
}

export interface RequestsResponse {
  total: number;
  requests: TracedRequest[];
}

export interface FlowsResponse {
  total: number;
  flows: Array<{ id: string; requests: TracedRequest[] }>;
}

export interface InsightsResponse {
  insights: readonly StatefulInsight[];
}

export interface SecurityFindingsResponse {
  findings: readonly StatefulFinding[];
}

export interface FindingsResponse {
  total: number;
  findings: readonly StatefulFinding[];
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
