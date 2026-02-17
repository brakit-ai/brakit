import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  MetricsData,
  SessionMetric,
  EndpointMetrics,
  TracedRequest,
} from "../types.js";
import {
  METRICS_DIR,
  METRICS_FILE,
  METRICS_FLUSH_INTERVAL_MS,
  METRICS_MAX_SESSIONS,
} from "../constants.js";

export class MetricsStore {
  private data: MetricsData = { version: 1, endpoints: [] };
  private sessionId = randomUUID();
  private sessionStart = Date.now();
  private metricsPath: string;
  private metricsDir: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  // Per-endpoint accumulators for the current session
  private accumulators = new Map<
    string,
    { durations: number[]; errorCount: number; queryCounts: number[] }
  >();

  constructor(rootDir: string) {
    this.metricsDir = resolve(rootDir, METRICS_DIR);
    this.metricsPath = resolve(rootDir, METRICS_FILE);
    this.load();
  }

  /** Start periodic flushing to disk. */
  start(): void {
    this.flushTimer = setInterval(() => this.flush(), METRICS_FLUSH_INTERVAL_MS);
    this.flushTimer.unref();
  }

  /** Stop flushing and write final metrics to disk. */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  /** Record a completed request for aggregation. */
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

  /** Get all persisted endpoint metrics (for the API). */
  getAll(): readonly EndpointMetrics[] {
    return this.data.endpoints;
  }

  /** Get metrics for a specific endpoint. */
  getEndpoint(endpoint: string): EndpointMetrics | undefined {
    return this.data.endpoints.find((e) => e.endpoint === endpoint);
  }

  /** Reset all metrics — clears memory, accumulators, and disk file. */
  reset(): void {
    this.data = { version: 1, endpoints: [] };
    this.accumulators.clear();
    try {
      if (existsSync(this.metricsPath)) {
        unlinkSync(this.metricsPath);
      }
    } catch {
      // Non-critical
    }
  }

  /** Flush current session accumulators into persisted data and write to disk. */
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

      // Replace existing session entry (from previous flush) or add new
      const existingIdx = epMetrics.sessions.findIndex(
        (s) => s.sessionId === this.sessionId,
      );
      if (existingIdx !== -1) {
        epMetrics.sessions[existingIdx] = session;
      } else {
        epMetrics.sessions.push(session);
      }

      // Cap to max sessions
      if (epMetrics.sessions.length > METRICS_MAX_SESSIONS) {
        epMetrics.sessions = epMetrics.sessions.slice(-METRICS_MAX_SESSIONS);
      }
    }

    this.save();
  }

  private load(): void {
    try {
      if (existsSync(this.metricsPath)) {
        const raw = readFileSync(this.metricsPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && Array.isArray(parsed.endpoints)) {
          this.data = parsed as MetricsData;
        }
      }
    } catch {
      // Corrupted file — start fresh
      this.data = { version: 1, endpoints: [] };
    }
  }

  private save(): void {
    try {
      if (!existsSync(this.metricsDir)) {
        mkdirSync(this.metricsDir, { recursive: true });
        this.ensureGitignore();
      }
      writeFileSync(this.metricsPath, JSON.stringify(this.data, null, 2));
    } catch {
      // Disk write failed — non-critical, skip silently
    }
  }

  /** Add .brakit to .gitignore if not already present. */
  private ensureGitignore(): void {
    try {
      const gitignorePath = resolve(this.metricsDir, "../.gitignore");
      const entry = METRICS_DIR;
      if (existsSync(gitignorePath)) {
        const content = readFileSync(gitignorePath, "utf-8");
        if (content.split("\n").some((l) => l.trim() === entry)) return;
        writeFileSync(gitignorePath, content.trimEnd() + "\n" + entry + "\n");
      } else {
        writeFileSync(gitignorePath, entry + "\n");
      }
    } catch {
      // Non-critical — skip silently
    }
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(p * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}
