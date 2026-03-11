import type {
  TracedQuery,
  TracedError,
  TracedLog,
  TracedFetch,
  SecurityFinding,
} from "../types/index.js";
import { ANALYSIS_DEBOUNCE_MS } from "../constants/limits.js";
import type { ServiceRegistry } from "../core/service-registry.js";
import { SubscriptionBag } from "../core/disposable.js";
import type { AnalysisUpdate } from "../core/event-bus.js";
import { groupRequestsIntoFlows } from "./group.js";
import { createDefaultScanner, type SecurityScanner } from "./rules/index.js";
import { computeInsights, type Insight } from "./insights.js";
import { insightToIssue, securityFindingToIssue } from "./issue-mappers.js";
import { computeIssueId } from "../utils/issue-id.js";
import { extractActiveEndpoints, windowByEndpoint } from "./insights/prepare.js";

export type { AnalysisUpdate };

export class AnalysisEngine {
  private scanner: SecurityScanner;
  private cachedInsights: Insight[] = [];
  private cachedFindings: SecurityFinding[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new SubscriptionBag();

  constructor(
    private registry: ServiceRegistry,
    private debounceMs = ANALYSIS_DEBOUNCE_MS,
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

  private scheduleRecompute(): void {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.recompute();
    }, this.debounceMs);
  }

  recompute(): void {
    const allRequests = this.registry.get("request-store").getAll();
    const queries = this.registry.get("query-store").getAll() as readonly TracedQuery[];
    const errors = this.registry.get("error-store").getAll() as readonly TracedError[];
    const logs = this.registry.get("log-store").getAll() as readonly TracedLog[];
    const fetches = this.registry.get("fetch-store").getAll() as readonly TracedFetch[];

    const requests = windowByEndpoint(allRequests);
    const flows = groupRequestsIntoFlows(requests);

    this.cachedFindings = this.scanner.scan({ requests, logs });
    this.cachedInsights = computeInsights({
      requests,
      queries,
      errors,
      flows,
      fetches,
      previousMetrics: this.registry.get("metrics-store").getAll(),
      securityFindings: this.cachedFindings,
    });

    if (this.registry.has("issue-store")) {
      const issueStore = this.registry.get("issue-store");

      // Upsert security findings into IssueStore
      for (const finding of this.cachedFindings) {
        issueStore.upsert(securityFindingToIssue(finding), "passive");
      }

      // Upsert performance/reliability insights into IssueStore
      for (const insight of this.cachedInsights) {
        issueStore.upsert(insightToIssue(insight), "passive");
      }

      // Build the set of currently-detected issue IDs for reconciliation
      const currentIssueIds = new Set<string>();
      for (const finding of this.cachedFindings) {
        currentIssueIds.add(computeIssueId(securityFindingToIssue(finding)));
      }
      for (const insight of this.cachedInsights) {
        currentIssueIds.add(computeIssueId(insightToIssue(insight)));
      }

      const activeEndpoints = extractActiveEndpoints(allRequests);
      issueStore.reconcile(currentIssueIds, activeEndpoints);

      const update: AnalysisUpdate = {
        insights: this.cachedInsights,
        findings: this.cachedFindings,
        issues: issueStore.getAll(),
      };

      this.registry.get("event-bus").emit("analysis:updated", update);
    }
  }
}
