import type { BrakitClient } from "./client.js";
import type { TracedRequest, TracedQuery, TracedFetch } from "../types/index.js";
import type { SecurityFinding } from "../types/index.js";
import type { Insight } from "../analysis/insights/types.js";
import type { LiveEndpointData } from "../types/metrics.js";
import type { StatefulFinding } from "../types/finding-lifecycle.js";

export interface McpToolInputProperty {
  type: string;
  description: string;
  enum?: readonly string[];
}

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, McpToolInputProperty>;
    required?: readonly string[];
  };
  handler: (
    client: BrakitClient,
    args: Record<string, unknown>,
  ) => Promise<McpToolResult>;
}

export interface EnrichedFinding {
  findingId: string;
  severity: string;
  title: string;
  endpoint: string;
  description: string;
  hint: string;
  occurrences: number;
  context: string;
}

export interface EndpointSummary {
  endpoint: string;
  p95Ms: number;
  errorRate: number;
  avgQueryCount: number;
  totalRequests: number;
  avgQueryTimeMs: number;
  avgFetchTimeMs: number;
  avgAppTimeMs: number;
}

export interface TimelineEvent {
  type: "fetch" | "log" | "error" | "query";
  timestamp: number;
  data: Record<string, unknown>;
}

export interface RequestDetail {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  queries: TracedQuery[];
  fetches: TracedFetch[];
  timeline: TimelineEvent[];
}

export type EndpointSortKey = "p95" | "error_rate" | "query_count" | "requests";

export interface RequestsResponse {
  total: number;
  requests: TracedRequest[];
}

export interface SecurityFindingsResponse {
  findings: SecurityFinding[];
}

export interface InsightsResponse {
  insights: Insight[];
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

export interface LiveMetricsResponse {
  endpoints: LiveEndpointData[];
}

export interface FindingsResponse {
  total: number;
  findings: StatefulFinding[];
}
