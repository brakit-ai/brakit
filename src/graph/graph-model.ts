/** LiveGraph data model — runtime dependency graph types. */

export type NodeType = "endpoint" | "cluster" | "table" | "external";
export type EdgeType = "reads" | "writes" | "fetches" | "calls";

export interface GraphNodeStats {
  requestCount: number;
  avgLatencyMs: number;
  errorRate: number;
  avgQueryCount: number;
  lastSeenAt: number;
  firstSeenAt: number;
}

export interface SecurityFindingSummary {
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

export interface NodeAnnotations {
  categories?: string[];
  hasAuth?: boolean;
  isMiddleware?: boolean;
  securityFindings?: SecurityFindingSummary[];
  insights?: InsightSummary[];
  openIssueCount?: number;
  p95Ms?: number;
}

export interface EdgeAnnotations {
  hasIssue?: boolean;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  children?: string[];
  stats: GraphNodeStats;
  annotations?: NodeAnnotations;
}

export interface GraphEdgeStats {
  frequency: number;
  avgLatencyMs: number;
  lastSeenAt: number;
  firstSeenAt: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  stats: GraphEdgeStats;
  patterns?: string[];
  annotations?: EdgeAnnotations;
}

export interface LiveGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  metadata: {
    totalObservations: number;
    lastUpdatedAt: number;
  };
}

export interface ClusterInfo {
  id: string;
  label: string;
  children: string[];
  stats: GraphNodeStats;
}

export interface SerializedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: { totalObservations: number; lastUpdatedAt: number };
}

export interface GraphApiResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: ClusterInfo[];
  metadata: { totalObservations: number; lastUpdatedAt: number };
}
