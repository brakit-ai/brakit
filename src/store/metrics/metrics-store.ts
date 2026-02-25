import { randomUUID } from "node:crypto";
import type {
  MetricsData,
  SessionMetric,
  EndpointMetrics,
  TracedRequest,
  LiveRequestPoint,
  LiveEndpointData,
  RequestMetrics,
} from "../../types/index.js";
import {
  METRICS_FLUSH_INTERVAL_MS,
  METRICS_MAX_SESSIONS,
  METRICS_MAX_DATA_POINTS,
} from "../../constants/index.js";
import { percentile } from "../../utils/math.js";
import { getEndpointKey } from "../../utils/endpoint.js";
import type { MetricsPersistence } from "./persistence.js";

interface Accumulator {
  durations: number[];
  queryCounts: number[];
  errorCount: number;
  totalDurationSum: number;
  totalRequestCount: number;
  totalErrorCount: number;
  totalQuerySum: number;
  totalQueryTimeMs: number;
  totalFetchTimeMs: number;
}

function createAccumulator(): Accumulator {
  return {
    durations: [],
    queryCounts: [],
    errorCount: 0,
    totalDurationSum: 0,
    totalRequestCount: 0,
    totalErrorCount: 0,
    totalQuerySum: 0,
    totalQueryTimeMs: 0,
    totalFetchTimeMs: 0,
  };
}

export class MetricsStore {
  private data: MetricsData;
  private endpointIndex = new Map<string, EndpointMetrics>();
  private sessionId = randomUUID();
  private sessionStart = Date.now();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private accumulators = new Map<string, Accumulator>();
  private pendingPoints = new Map<string, LiveRequestPoint[]>();

  constructor(private persistence: MetricsPersistence) {
    this.data = persistence.load();
    for (const ep of this.data.endpoints) {
      this.endpointIndex.set(ep.endpoint, ep);
    }
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
    this.flush(true);
  }

  recordRequest(req: TracedRequest, metrics: RequestMetrics): void {
    if (req.isStatic) return;
    const key = getEndpointKey(req.method, req.path);

    let acc = this.accumulators.get(key);
    if (!acc) {
      acc = createAccumulator();
      this.accumulators.set(key, acc);
    }

    acc.durations.push(req.durationMs);
    acc.queryCounts.push(metrics.queryCount);
    if (req.statusCode >= 400) acc.errorCount++;

    acc.totalDurationSum += req.durationMs;
    acc.totalRequestCount++;
    acc.totalQuerySum += metrics.queryCount;
    acc.totalQueryTimeMs += metrics.queryTimeMs;
    acc.totalFetchTimeMs += metrics.fetchTimeMs;
    if (req.statusCode >= 400) acc.totalErrorCount++;

    const timestamp = Math.round(
      Date.now() - (performance.now() - req.startedAt),
    );
    const point: LiveRequestPoint = {
      timestamp,
      durationMs: req.durationMs,
      statusCode: req.statusCode,
      queryCount: metrics.queryCount,
      queryTimeMs: metrics.queryTimeMs,
      fetchTimeMs: metrics.fetchTimeMs,
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
    return this.endpointIndex.get(endpoint);
  }

  getLiveEndpoints(): LiveEndpointData[] {
    const merged = new Map<string, LiveRequestPoint[]>();

    for (const ep of this.data.endpoints) {
      if (ep.dataPoints && ep.dataPoints.length > 0) {
        merged.set(ep.endpoint, ep.dataPoints);
      }
    }

    for (const [endpoint, points] of this.pendingPoints) {
      const existing = merged.get(endpoint);
      merged.set(endpoint, existing ? existing.concat(points) : points);
    }

    const endpoints: LiveEndpointData[] = [];

    for (const [endpoint, requests] of merged) {
      if (requests.length === 0) continue;

      const durations = requests.map((r) => r.durationMs);
      const errors = requests.filter((r) => r.statusCode >= 400).length;
      const totalQueries = requests.reduce((s, r) => s + r.queryCount, 0);
      const totalQueryTime = requests.reduce((s, r) => s + (r.queryTimeMs ?? 0), 0);
      const totalFetchTime = requests.reduce((s, r) => s + (r.fetchTimeMs ?? 0), 0);
      const n = requests.length;

      const avgDurationMs = Math.round(durations.reduce((s, d) => s + d, 0) / n);
      const avgQueryTimeMs = Math.round(totalQueryTime / n);
      const avgFetchTimeMs = Math.round(totalFetchTime / n);

      endpoints.push({
        endpoint,
        requests,
        summary: {
          p95Ms: percentile(durations, 0.95),
          errorRate: errors / n,
          avgQueryCount: Math.round(totalQueries / n),
          totalRequests: n,
          avgQueryTimeMs,
          avgFetchTimeMs,
          avgAppTimeMs: Math.max(0, avgDurationMs - avgQueryTimeMs - avgFetchTimeMs),
        },
      });
    }

    endpoints.sort((a, b) => b.summary.p95Ms - a.summary.p95Ms);
    return endpoints;
  }

  reset(): void {
    this.data = { version: 1, endpoints: [] };
    this.endpointIndex.clear();
    this.accumulators.clear();
    this.pendingPoints.clear();
    this.persistence.remove();
  }

  flush(sync = false): void {
    for (const [endpoint, acc] of this.accumulators) {
      if (acc.durations.length === 0) continue;

      const n = acc.totalRequestCount;
      const session: SessionMetric = {
        sessionId: this.sessionId,
        startedAt: this.sessionStart,
        avgDurationMs: Math.round(acc.totalDurationSum / n),
        p95DurationMs: percentile(acc.durations, 0.95),
        requestCount: n,
        errorCount: acc.totalErrorCount,
        avgQueryCount: n > 0 ? Math.round(acc.totalQuerySum / n) : 0,
        avgQueryTimeMs: n > 0 ? Math.round(acc.totalQueryTimeMs / n) : 0,
        avgFetchTimeMs: n > 0 ? Math.round(acc.totalFetchTimeMs / n) : 0,
      };

      const epMetrics = this.getOrCreateEndpoint(endpoint);

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

      acc.durations.length = 0;
      acc.queryCounts.length = 0;
      acc.errorCount = 0;
    }

    for (const [endpoint, points] of this.pendingPoints) {
      if (points.length === 0) continue;

      const epMetrics = this.getOrCreateEndpoint(endpoint);
      const existing = epMetrics.dataPoints ?? [];
      epMetrics.dataPoints = existing.concat(points).slice(-METRICS_MAX_DATA_POINTS);
    }
    this.pendingPoints.clear();

    if (sync) {
      this.persistence.saveSync(this.data);
    } else {
      this.persistence.save(this.data);
    }
  }

  private getOrCreateEndpoint(endpoint: string): EndpointMetrics {
    let ep = this.endpointIndex.get(endpoint);
    if (!ep) {
      ep = { endpoint, sessions: [] };
      this.data.endpoints.push(ep);
      this.endpointIndex.set(endpoint, ep);
    }
    return ep;
  }
}
