import type {
  TracedRequest,
  TracedQuery,
  TracedError,
  TracedLog,
  SecurityFinding,
  RequestListener,
} from "../types/index.js";
import type { RequestFlow } from "../types/index.js";
import type { TelemetryListener } from "../store/index.js";
import { getRequests } from "../proxy/request-log.js";
import {
  defaultQueryStore,
  defaultErrorStore,
  defaultLogStore,
  defaultFetchStore,
} from "../store/index.js";
import { onRequest, offRequest } from "../proxy/request-log.js";
import { groupRequestsIntoFlows } from "./group.js";
import { createDefaultScanner, type SecurityScanner } from "./rules/index.js";
import { computeInsights, type Insight } from "./insights.js";

export type AnalysisListener = (insights: Insight[], findings: SecurityFinding[]) => void;

export class AnalysisEngine {
  private scanner: SecurityScanner;
  private cachedInsights: Insight[] = [];
  private cachedFindings: SecurityFinding[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: AnalysisListener[] = [];
  private boundRequestListener: RequestListener;
  private boundQueryListener: TelemetryListener<TracedQuery>;
  private boundErrorListener: TelemetryListener<TracedError>;
  private boundLogListener: TelemetryListener<TracedLog>;

  constructor(private debounceMs = 300) {
    this.scanner = createDefaultScanner();

    this.boundRequestListener = () => this.scheduleRecompute();
    this.boundQueryListener = () => this.scheduleRecompute();
    this.boundErrorListener = () => this.scheduleRecompute();
    this.boundLogListener = () => this.scheduleRecompute();
  }

  start(): void {
    onRequest(this.boundRequestListener);
    defaultQueryStore.onEntry(this.boundQueryListener);
    defaultErrorStore.onEntry(this.boundErrorListener);
    defaultLogStore.onEntry(this.boundLogListener);
  }

  stop(): void {
    offRequest(this.boundRequestListener);
    defaultQueryStore.offEntry(this.boundQueryListener);
    defaultErrorStore.offEntry(this.boundErrorListener);
    defaultLogStore.offEntry(this.boundLogListener);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  onUpdate(fn: AnalysisListener): void {
    this.listeners.push(fn);
  }

  offUpdate(fn: AnalysisListener): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }

  getInsights(): readonly Insight[] {
    return this.cachedInsights;
  }

  getFindings(): readonly SecurityFinding[] {
    return this.cachedFindings;
  }

  private scheduleRecompute(): void {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.recompute();
    }, this.debounceMs);
  }

  recompute(): void {
    const requests = getRequests();
    const queries = defaultQueryStore.getAll() as readonly TracedQuery[];
    const errors = defaultErrorStore.getAll() as readonly TracedError[];
    const logs = defaultLogStore.getAll() as readonly TracedLog[];
    const flows = groupRequestsIntoFlows(requests);

    this.cachedFindings = this.scanner.scan({ requests, logs });

    this.cachedInsights = computeInsights({
      requests,
      queries,
      errors,
      flows,
      securityFindings: this.cachedFindings,
    });

    for (const fn of this.listeners) {
      try { fn(this.cachedInsights, this.cachedFindings); } catch { /* listener failure is non-fatal */ }
    }
  }
}
