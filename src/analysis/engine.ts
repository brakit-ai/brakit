import type {
  TracedQuery,
  TracedError,
  TracedLog,
  TracedFetch,
  SecurityFinding,
} from "../types/index.js";
import { ANALYSIS_DEBOUNCE_MS } from "../constants/config.js";
import type { Services } from "../core/services.js";
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
    private services: Services,
    private debounceMs = ANALYSIS_DEBOUNCE_MS,
  ) {
    this.scanner = createDefaultScanner();
  }

  start(): void {
    const bus = this.services.bus;
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
    const allRequests = this.services.requestStore.getAll();
    const queries = this.services.queryStore.getAll() as readonly TracedQuery[];
    const errors = this.services.errorStore.getAll() as readonly TracedError[];
    const logs = this.services.logStore.getAll() as readonly TracedLog[];
    const fetches = this.services.fetchStore.getAll() as readonly TracedFetch[];

    const requests = windowByEndpoint(allRequests);
    const flows = groupRequestsIntoFlows(requests);

    this.cachedFindings = this.scanner.scan({ requests, logs });
    this.cachedInsights = computeInsights({
      requests,
      queries,
      errors,
      flows,
      fetches,
      previousMetrics: this.services.metricsStore.getAll(),
      securityFindings: this.cachedFindings,
    });

    const issueStore = this.services.issueStore;

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

    this.services.bus.emit("analysis:updated", update);
  }
}
