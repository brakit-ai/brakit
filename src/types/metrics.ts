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

export interface EndpointMetrics {
  endpoint: string;
  sessions: SessionMetric[];
  dataPoints?: LiveRequestPoint[];
}

export interface MetricsData {
  version: 1;
  endpoints: EndpointMetrics[];
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

export interface RequestMetrics {
  queryCount: number;
  queryTimeMs: number;
  fetchTimeMs: number;
}
