import type {
  TracedRequest,
  TracedQuery,
  TracedError,
  TracedLog,
  TracedFetch,
  SecurityFinding,
  RequestListener,
} from "../types/index.js";
import type { StatefulFinding } from "../types/finding-lifecycle.js";
import type { StatefulInsight } from "../types/insight-lifecycle.js";
import type { TelemetryListener } from "../store/index.js";
import type { MetricsStore } from "../store/index.js";
import type { FindingStore } from "../store/finding-store.js";
import { getRequests } from "../store/request-log.js";
import {
  defaultQueryStore,
  defaultErrorStore,
  defaultLogStore,
  defaultFetchStore,
} from "../store/index.js";
import { onRequest, offRequest } from "../store/request-log.js";
import { groupRequestsIntoFlows } from "./group.js";
import { createDefaultScanner, type SecurityScanner } from "./rules/index.js";
import { computeInsights, type Insight } from "./insights.js";
import { InsightTracker } from "./insight-tracker.js";

export interface AnalysisUpdate {
  insights: Insight[];
  findings: SecurityFinding[];
  statefulFindings: readonly StatefulFinding[];
  statefulInsights: readonly StatefulInsight[];
}

export type AnalysisListener = (update: AnalysisUpdate) => void;

export class AnalysisEngine {
  private scanner: SecurityScanner;
  private insightTracker = new InsightTracker();
  private cachedInsights: Insight[] = [];
  private cachedFindings: SecurityFinding[] = [];
  private cachedStatefulInsights: readonly StatefulInsight[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: AnalysisListener[] = [];
  private boundRequestListener: RequestListener;
  private boundQueryListener: TelemetryListener<TracedQuery>;
  private boundErrorListener: TelemetryListener<TracedError>;
  private boundLogListener: TelemetryListener<TracedLog>;

  constructor(
    private metricsStore: MetricsStore,
    private findingStore?: FindingStore,
    private debounceMs = 300,
  ) {
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

  getStatefulFindings(): readonly StatefulFinding[] {
    return this.findingStore?.getAll() ?? [];
  }

  getStatefulInsights(): readonly StatefulInsight[] {
    return this.cachedStatefulInsights;
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
    const fetches = defaultFetchStore.getAll() as readonly TracedFetch[];
    const flows = groupRequestsIntoFlows(requests);

    this.cachedFindings = this.scanner.scan({ requests, logs });

    if (this.findingStore) {
      for (const finding of this.cachedFindings) {
        this.findingStore.upsert(finding, "passive");
      }
      this.findingStore.reconcilePassive(this.cachedFindings);
    }

    this.cachedInsights = computeInsights({
      requests,
      queries,
      errors,
      flows,
      fetches,
      previousMetrics: this.metricsStore.getAll(),
      securityFindings: this.cachedFindings,
    });

    this.cachedStatefulInsights = this.insightTracker.reconcile(this.cachedInsights);

    const update: AnalysisUpdate = {
      insights: this.cachedInsights,
      findings: this.cachedFindings,
      statefulFindings: this.getStatefulFindings(),
      statefulInsights: this.cachedStatefulInsights,
    };

    for (const fn of this.listeners) {
      try { fn(update); } catch { /* non-fatal */ }
    }
  }
}
