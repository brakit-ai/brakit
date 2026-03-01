import type {
  TracedQuery,
  TracedError,
  TracedLog,
  TracedFetch,
  SecurityFinding,
} from "../types/index.js";
import type { StatefulFinding } from "../types/finding-lifecycle.js";
import type { StatefulInsight } from "../types/insight-lifecycle.js";
import type { ServiceRegistry } from "../core/service-registry.js";
import { SubscriptionBag } from "../core/disposable.js";
import type { AnalysisUpdate } from "../core/event-bus.js";
import { groupRequestsIntoFlows } from "./group.js";
import { createDefaultScanner, type SecurityScanner } from "./rules/index.js";
import { computeInsights, type Insight } from "./insights.js";
import { InsightTracker } from "./insight-tracker.js";

export type { AnalysisUpdate };

export class AnalysisEngine {
  private scanner: SecurityScanner;
  private insightTracker = new InsightTracker();
  private cachedInsights: Insight[] = [];
  private cachedFindings: SecurityFinding[] = [];
  private cachedStatefulInsights: readonly StatefulInsight[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new SubscriptionBag();

  constructor(
    private registry: ServiceRegistry,
    private debounceMs = 300,
  ) {
    this.scanner = createDefaultScanner();
  }

  start(): void {
    const bus = this.registry.get("event-bus");
    this.subs.add(bus.on("request:completed", () => this.scheduleRecompute()));
    this.subs.add(bus.on("telemetry:query", () => this.scheduleRecompute()));
    this.subs.add(bus.on("telemetry:error", () => this.scheduleRecompute()));
    this.subs.add(bus.on("telemetry:log", () => this.scheduleRecompute()));
  }

  stop(): void {
    this.subs.dispose();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  getInsights(): readonly Insight[] {
    return this.cachedInsights;
  }

  getFindings(): readonly SecurityFinding[] {
    return this.cachedFindings;
  }

  getStatefulFindings(): readonly StatefulFinding[] {
    return this.registry.has("finding-store")
      ? this.registry.get("finding-store").getAll()
      : [];
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
    const requests = this.registry.get("request-store").getAll();
    const queries = this.registry.get("query-store").getAll() as readonly TracedQuery[];
    const errors = this.registry.get("error-store").getAll() as readonly TracedError[];
    const logs = this.registry.get("log-store").getAll() as readonly TracedLog[];
    const fetches = this.registry.get("fetch-store").getAll() as readonly TracedFetch[];
    const flows = groupRequestsIntoFlows(requests);

    this.cachedFindings = this.scanner.scan({ requests, logs });

    if (this.registry.has("finding-store")) {
      const findingStore = this.registry.get("finding-store");
      for (const finding of this.cachedFindings) {
        findingStore.upsert(finding, "passive");
      }
      findingStore.reconcilePassive(this.cachedFindings);
    }

    this.cachedInsights = computeInsights({
      requests,
      queries,
      errors,
      flows,
      fetches,
      previousMetrics: this.registry.get("metrics-store").getAll(),
      securityFindings: this.cachedFindings,
    });

    this.cachedStatefulInsights = this.insightTracker.reconcile(this.cachedInsights);

    const update: AnalysisUpdate = {
      insights: this.cachedInsights,
      findings: this.cachedFindings,
      statefulFindings: this.getStatefulFindings(),
      statefulInsights: this.cachedStatefulInsights,
    };

    this.registry.get("event-bus").emit("analysis:updated", update);
  }
}
