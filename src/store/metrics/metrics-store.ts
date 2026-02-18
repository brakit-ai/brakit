import { randomUUID } from "node:crypto";
import type {
  MetricsData,
  SessionMetric,
  EndpointMetrics,
  TracedRequest,
} from "../../types/index.js";
import {
  METRICS_FLUSH_INTERVAL_MS,
  METRICS_MAX_SESSIONS,
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
    let acc = this.accumulators.get(key);
    if (!acc) {
      acc = { durations: [], errorCount: 0, queryCounts: [] };
      this.accumulators.set(key, acc);
    }
    acc.durations.push(req.durationMs);
    acc.queryCounts.push(queryCount);
    if (req.statusCode >= 400) acc.errorCount++;
  }

  getAll(): readonly EndpointMetrics[] {
    return this.data.endpoints;
  }

  getEndpoint(endpoint: string): EndpointMetrics | undefined {
    return this.data.endpoints.find((e) => e.endpoint === endpoint);
  }

  reset(): void {
    this.data = { version: 1, endpoints: [] };
    this.accumulators.clear();
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

    this.persistence.save(this.data);
  }
}
