import { randomUUID } from "node:crypto";
import type {
  MetricsData,
  SessionMetric,
  EndpointMetrics,
  TracedRequest,
  LiveRequestPoint,
  LiveEndpointData,
} from "../../types/index.js";
import {
  METRICS_FLUSH_INTERVAL_MS,
  METRICS_MAX_SESSIONS,
  METRICS_MAX_DATA_POINTS,
} from "../../constants/index.js";
import { percentile } from "../../utils/math.js";
import type { MetricsPersistence } from "./persistence.js";

export class MetricsStore {
  private data: MetricsData;
  private sessionId = randomUUID();
  private sessionStart = Date.now();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  private accumulators = new Map<
    string,
    { durations: number[]; errorCount: number; queryCounts: number[] }
  >();

  /** Pending data points not yet flushed to disk. */
  private pendingPoints = new Map<string, LiveRequestPoint[]>();

  constructor(private persistence: MetricsPersistence) {
    this.data = persistence.load();
  }

  start(): void {
    this.flushTimer = setInterval(
      () => this.flush(),
      METRICS_FLUSH_INTERVAL_MS,
    );
    this.flushTimer.unref();
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  recordRequest(req: TracedRequest, queryCount: number): void {
    if (req.isStatic) return;
    const key = req.method + " " + req.path;

    // Session accumulator (existing behavior)
    let acc = this.accumulators.get(key);
    if (!acc) {
      acc = { durations: [], errorCount: 0, queryCounts: [] };
      this.accumulators.set(key, acc);
    }
    acc.durations.push(req.durationMs);
    acc.queryCounts.push(queryCount);
    if (req.statusCode >= 400) acc.errorCount++;

    // Individual data point (wall-clock timestamp)
    const timestamp = Math.round(
      Date.now() - (performance.now() - req.startedAt),
    );
    const point: LiveRequestPoint = {
      timestamp,
      durationMs: req.durationMs,
      statusCode: req.statusCode,
      queryCount,
    };
    let pending = this.pendingPoints.get(key);
    if (!pending) {
      pending = [];
      this.pendingPoints.set(key, pending);
    }
    pending.push(point);
  }

  getAll(): readonly EndpointMetrics[] {
    return this.data.endpoints;
  }

  getEndpoint(endpoint: string): EndpointMetrics | undefined {
    return this.data.endpoints.find((e) => e.endpoint === endpoint);
  }

  /** Returns live per-request data for the performance tab. */
  getLiveEndpoints(): LiveEndpointData[] {
    // Merge persisted data points with pending (unflushed) points
    const merged = new Map<string, LiveRequestPoint[]>();

    for (const ep of this.data.endpoints) {
      if (ep.dataPoints && ep.dataPoints.length > 0) {
        merged.set(ep.endpoint, [...ep.dataPoints]);
      }
    }

    for (const [endpoint, points] of this.pendingPoints) {
      const existing = merged.get(endpoint) || [];
      existing.push(...points);
      merged.set(endpoint, existing);
    }

    const endpoints: LiveEndpointData[] = [];

    for (const [endpoint, requests] of merged) {
      if (requests.length === 0) continue;
      const durations = requests.map((r) => r.durationMs);
      const errors = requests.filter((r) => r.statusCode >= 400).length;
      const totalQueries = requests.reduce((s, r) => s + r.queryCount, 0);

      endpoints.push({
        endpoint,
        requests,
        summary: {
          p95Ms: percentile(durations, 0.95),
          errorRate: requests.length > 0 ? errors / requests.length : 0,
          avgQueryCount:
            requests.length > 0
              ? Math.round(totalQueries / requests.length)
              : 0,
          totalRequests: requests.length,
        },
      });
    }

    endpoints.sort((a, b) => b.summary.p95Ms - a.summary.p95Ms);
    return endpoints;
  }

  reset(): void {
    this.data = { version: 1, endpoints: [] };
    this.accumulators.clear();
    this.pendingPoints.clear();
    this.persistence.remove();
  }

  flush(): void {
    for (const [endpoint, acc] of this.accumulators) {
      if (acc.durations.length === 0) continue;

      const session: SessionMetric = {
        sessionId: this.sessionId,
        startedAt: this.sessionStart,
        avgDurationMs: Math.round(
          acc.durations.reduce((s, d) => s + d, 0) / acc.durations.length,
        ),
        p95DurationMs: percentile(acc.durations, 0.95),
        requestCount: acc.durations.length,
        errorCount: acc.errorCount,
        avgQueryCount:
          acc.queryCounts.length > 0
            ? Math.round(
                acc.queryCounts.reduce((s, c) => s + c, 0) /
                  acc.queryCounts.length,
              )
            : 0,
      };

      let epMetrics = this.data.endpoints.find(
        (e) => e.endpoint === endpoint,
      );
      if (!epMetrics) {
        epMetrics = { endpoint, sessions: [] };
        this.data.endpoints.push(epMetrics);
      }

      const existingIdx = epMetrics.sessions.findIndex(
        (s) => s.sessionId === this.sessionId,
      );
      if (existingIdx !== -1) {
        epMetrics.sessions[existingIdx] = session;
      } else {
        epMetrics.sessions.push(session);
      }

      if (epMetrics.sessions.length > METRICS_MAX_SESSIONS) {
        epMetrics.sessions = epMetrics.sessions.slice(-METRICS_MAX_SESSIONS);
      }
    }

    // Merge pending data points into persisted data
    for (const [endpoint, points] of this.pendingPoints) {
      if (points.length === 0) continue;

      let epMetrics = this.data.endpoints.find(
        (e) => e.endpoint === endpoint,
      );
      if (!epMetrics) {
        epMetrics = { endpoint, sessions: [] };
        this.data.endpoints.push(epMetrics);
      }

      const existing = epMetrics.dataPoints || [];
      epMetrics.dataPoints = [...existing, ...points].slice(
        -METRICS_MAX_DATA_POINTS,
      );
    }
    this.pendingPoints.clear();

    this.persistence.save(this.data);
  }
}
