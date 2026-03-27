/** Shared types for the client-side dependency graph. */

export interface NodeAnnotations {
  categories?: string[];
  hasAuth?: boolean;
  isMiddleware?: boolean;
  securityFindings?: SecurityFinding[];
  insights?: InsightSummary[];
  openIssueCount?: number;
  p95Ms?: number;
}

export interface SecurityFinding {
  rule: string;
  severity: string;
  title: string;
  count: number;
}

export interface InsightSummary {
  type: string;
  severity: string;
  title: string;
}

export interface EdgeAnnotations {
  hasIssue?: boolean;
}

export interface GraphNode {
  id: string;
  type: "action" | "endpoint" | "table" | "external";
  label: string;
  stats: GraphNodeStats;
  annotations?: NodeAnnotations;
}

export interface GraphNodeStats {
  requestCount: number;
  avgLatencyMs: number;
  errorRate: number;
  avgQueryCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "triggers" | "reads" | "writes" | "fetches" | "calls";
  stats: GraphEdgeStats;
  patterns?: string[];
  annotations?: EdgeAnnotations;
}

export interface GraphEdgeStats {
  frequency: number;
  avgLatencyMs: number;
}

export interface FlowData {
  id: string;
  label: string;
  requests: { method: string; path: string; durationMs: number }[];
  totalDurationMs: number;
}

export interface ConsolidatedFlow {
  label: string;
  occurrences: number;
  endpointKeys: Set<string>;
  avgDurationMs: number;
}

/** Positioned node — a GraphNode with layout coordinates. */
export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  type: GraphNode["type"];
  stats: GraphNodeStats;
  annotations?: NodeAnnotations;
}

/** Positioned edge — a GraphEdge with computed SVG coordinates. */
export interface PositionedEdge {
  key: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  label: string;
  color: string;
  thickness: number;
  dashed: boolean;
  data: GraphEdge;
}

export type OverlayLayer = "auth" | "security" | "performance" | "issues" | "heat";
export type DetailTab = "overview" | "security" | "performance" | "issues";
