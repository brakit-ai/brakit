import type {
  TracedRequest,
  TelemetryEntry,
  SecurityFinding,
  EndpointMetrics,
  RequestMetrics,
  LiveEndpointData,
} from "./index.js";
import type {
  StatefulFinding,
  FindingState,
  FindingSource,
} from "./finding-lifecycle.js";
import type { StatefulInsight } from "./insight-lifecycle.js";
import type { CaptureInput } from "../store/request-store.js";
import type { Insight } from "../analysis/insights.js";

export interface TelemetryStoreInterface<T extends TelemetryEntry> {
  add(data: Omit<T, "id">): T;
  getAll(): readonly T[];
  getByRequest(requestId: string): T[];
  clear(): void;
}

export interface RequestStoreInterface {
  capture(input: CaptureInput): TracedRequest;
  getAll(): readonly TracedRequest[];
  clear(): void;
}

export interface MetricsStoreInterface {
  recordRequest(req: TracedRequest, metrics: RequestMetrics): void;
  getAll(): readonly EndpointMetrics[];
  getEndpoint(endpoint: string): EndpointMetrics | undefined;
  getLiveEndpoints(): LiveEndpointData[];
  reset(): void;
  start(): void;
  stop(): void;
}

export interface FindingStoreInterface {
  upsert(finding: SecurityFinding, source: FindingSource): StatefulFinding;
  transition(findingId: string, state: FindingState): boolean;
  reconcilePassive(findings: readonly SecurityFinding[]): void;
  getAll(): readonly StatefulFinding[];
  getByState(state: FindingState): readonly StatefulFinding[];
  get(findingId: string): StatefulFinding | undefined;
  clear(): void;
  start(): void;
  stop(): void;
}

export interface AnalysisEngineInterface {
  start(): void;
  stop(): void;
  recompute(): void;
  getInsights(): readonly Insight[];
  getFindings(): readonly SecurityFinding[];
  getStatefulInsights(): readonly StatefulInsight[];
  getStatefulFindings(): readonly StatefulFinding[];
}
