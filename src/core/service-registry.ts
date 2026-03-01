import type { EventBus } from "./event-bus.js";
import type {
  RequestStoreInterface,
  TelemetryStoreInterface,
  MetricsStoreInterface,
  FindingStoreInterface,
  AnalysisEngineInterface,
} from "../types/services.js";
import type {
  TracedFetch,
  TracedQuery,
  TracedLog,
  TracedError,
} from "../types/index.js";

export interface ServiceMap {
  "event-bus": EventBus;
  "request-store": RequestStoreInterface;
  "query-store": TelemetryStoreInterface<TracedQuery>;
  "fetch-store": TelemetryStoreInterface<TracedFetch>;
  "log-store": TelemetryStoreInterface<TracedLog>;
  "error-store": TelemetryStoreInterface<TracedError>;
  "metrics-store": MetricsStoreInterface;
  "finding-store": FindingStoreInterface;
  "analysis-engine": AnalysisEngineInterface;
}

export class ServiceRegistry {
  private services = new Map<string, unknown>();

  register<K extends keyof ServiceMap>(name: K, service: ServiceMap[K]): void {
    this.services.set(name, service);
  }

  get<K extends keyof ServiceMap>(name: K): ServiceMap[K] {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service "${name}" not registered`);
    return service as ServiceMap[K];
  }

  has<K extends keyof ServiceMap>(name: K): boolean {
    return this.services.has(name);
  }
}
