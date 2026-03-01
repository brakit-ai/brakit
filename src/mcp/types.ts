import type { BrakitClient } from "./client.js";
import type { TracedQuery, TracedFetch } from "../types/index.js";

export type {
  TimelineEvent,
  RequestsResponse,
  SecurityFindingsResponse,
  InsightsResponse,
  TelemetryEntriesResponse,
  ActivityResponse,
  LiveMetricsResponse,
  FindingsResponse,
} from "../types/api-contracts.js";

import type { TimelineEvent } from "../types/api-contracts.js";

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
