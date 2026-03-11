import type {
  TracedRequest,
  TelemetryEntry,
  EndpointMetrics,
  RequestMetrics,
  LiveEndpointData,
} from "./index.js";
import type {
  Issue,
  StatefulIssue,
  IssueState,
  IssueSource,
  IssueCategory,
  AiFixStatus,
} from "./issue-lifecycle.js";
import type { CaptureInput } from "../store/request-store.js";
import type { Insight } from "../analysis/insights.js";
import type { SecurityFinding } from "./security.js";

export interface Lifecycle {
  start(): void;
  stop(): void;
}

export interface TelemetryStoreInterface<T extends TelemetryEntry> {
  add(data: Omit<T, "id">): T;
  getAll(): readonly T[];
  getByRequest(requestId: string): T[];
  clear(): void;
}

export interface RequestStoreInterface {
  capture(input: CaptureInput): TracedRequest;
  add(entry: TracedRequest): void;
  getAll(): readonly TracedRequest[];
  clear(): void;
}

export interface MetricsStoreInterface extends Lifecycle {
  recordRequest(req: TracedRequest, metrics: RequestMetrics): void;
  getAll(): readonly EndpointMetrics[];
  getEndpoint(endpoint: string): EndpointMetrics | undefined;
  getLiveEndpoints(): LiveEndpointData[];
  reset(): void;
}

export interface IssueStoreInterface extends Lifecycle {
  upsert(issue: Issue, source: IssueSource): StatefulIssue;
  transition(issueId: string, state: IssueState): boolean;
  reportFix(issueId: string, status: AiFixStatus, notes: string): boolean;
  reconcile(currentIssueIds: Set<string>, activeEndpoints: Set<string>): void;
  getAll(): readonly StatefulIssue[];
  getByState(state: IssueState): readonly StatefulIssue[];
  getByCategory(category: IssueCategory): readonly StatefulIssue[];
  get(issueId: string): StatefulIssue | undefined;
  clear(): void;
}

export interface AnalysisEngineInterface extends Lifecycle {
  recompute(): void;
  getInsights(): readonly Insight[];
  getFindings(): readonly SecurityFinding[];
}
