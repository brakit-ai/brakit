export interface SessionMetric {
  sessionId: string;
  startedAt: number;
  avgDurationMs: number;
  p95DurationMs: number;
  requestCount: number;
  errorCount: number;
  avgQueryCount: number;
}

export interface EndpointMetrics {
  endpoint: string;
  sessions: SessionMetric[];
}

export interface MetricsData {
  version: 1;
  endpoints: EndpointMetrics[];
}
