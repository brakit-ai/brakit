import type {
  TracedRequest,
  TracedQuery,
  TracedError,
  TracedFetch,
  SecurityFinding,
  EndpointMetrics,
} from "../../types/index.js";
import type { RequestFlow } from "../../types/index.js";

export type InsightSeverity = "critical" | "warning" | "info";
export type InsightType =
  | "n1" | "cross-endpoint" | "redundant-query" | "error" | "error-hotspot"
  | "duplicate" | "slow" | "query-heavy"
  | "select-star" | "high-rows" | "large-response" | "response-overfetch" | "security"
  | "regression";

export interface Insight {
  severity: InsightSeverity;
  type: InsightType;
  title: string;
  desc: string;
  hint: string;
  detail?: string;
  nav?: string;
}

export interface InsightContext {
  requests: readonly TracedRequest[];
  queries: readonly TracedQuery[];
  errors: readonly TracedError[];
  flows: readonly RequestFlow[];
  fetches: readonly TracedFetch[];
  previousMetrics?: readonly EndpointMetrics[];
  securityFindings?: readonly SecurityFinding[];
}

export interface EndpointGroup {
  total: number;
  errors: number;
  totalDuration: number;
  queryCount: number;
  totalSize: number;
  totalQueryTimeMs: number;
  totalFetchTimeMs: number;
  queryShapeDurations: Map<string, { totalMs: number; count: number; label: string }>;
}

export interface PreparedInsightContext extends InsightContext {
  nonStatic: readonly TracedRequest[];
  queriesByReq: ReadonlyMap<string, TracedQuery[]>;
  fetchesByReq: ReadonlyMap<string, TracedFetch[]>;
  reqById: ReadonlyMap<string, TracedRequest>;
  endpointGroups: ReadonlyMap<string, EndpointGroup>;
}
