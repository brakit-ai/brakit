import type { EventBus } from "./event-bus.js";
import type { RequestStore } from "../store/request-store.js";
import type { TelemetryStore } from "../store/telemetry-store.js";
import type { MetricsStore } from "../store/metrics/metrics-store.js";
import type { IssueStore } from "../store/issue-store.js";
import type { AnalysisEngine } from "../analysis/engine.js";
import type {
  TracedFetch,
  TracedQuery,
  TracedLog,
  TracedError,
} from "../types/index.js";

export interface Services {
  bus: EventBus;
  requestStore: RequestStore;
  queryStore: TelemetryStore<TracedQuery>;
  fetchStore: TelemetryStore<TracedFetch>;
  logStore: TelemetryStore<TracedLog>;
  errorStore: TelemetryStore<TracedError>;
  metricsStore: MetricsStore;
  issueStore: IssueStore;
  analysisEngine: AnalysisEngine;
}
