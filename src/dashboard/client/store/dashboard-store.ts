/** Central reactive store for dashboard state. */

import { createContext } from "@lit/context";
import { CLIENT_MAX_REQUESTS } from "../constants.js";
import type {
  DashboardState,
  DashboardView,
  StoreStateKey,
  TracedRequest,
  TracedFetch,
  TracedQuery,
  TracedLog,
  TracedError,
  FlowData,
  StatefulIssue,
  EndpointMetrics,
} from "./types.js";

export const dashboardContext = createContext<DashboardStore>("dashboard-store");

export class DashboardStore extends EventTarget {
  private _state: DashboardState = {
    flows: [],
    requests: [],
    fetches: [],
    errors: [],
    logs: [],
    queries: [],
    issues: [],
    metrics: [],
    viewMode: "simple",
    activeView: "overview",
  };

  get state(): Readonly<DashboardState> {
    return this._state;
  }

  private setState<K extends keyof DashboardState>(key: K, value: DashboardState[K]): void {
    this._state = { ...this._state, [key]: value };
    this.notify(key as StoreStateKey);
  }

  setFlows(flows: FlowData[]): void { this.setState("flows", flows); }
  setRequests(requests: TracedRequest[]): void { this.setState("requests", requests); }
  setFetches(fetches: TracedFetch[]): void { this.setState("fetches", fetches); }
  setErrors(errors: TracedError[]): void { this.setState("errors", errors); }
  setLogs(logs: TracedLog[]): void { this.setState("logs", logs); }
  setQueries(queries: TracedQuery[]): void { this.setState("queries", queries); }
  setIssues(issues: StatefulIssue[]): void { this.setState("issues", issues); }
  setMetrics(metrics: EndpointMetrics[]): void { this.setState("metrics", metrics); }

  prependRequest(req: TracedRequest): void {
    const requests = [req, ...this._state.requests.slice(0, CLIENT_MAX_REQUESTS - 1)];
    this._state = { ...this._state, requests };
    this.notify("requests");
  }

  prependFetch(f: TracedFetch): void {
    const fetches = [f, ...this._state.fetches.slice(0, CLIENT_MAX_REQUESTS - 1)];
    this._state = { ...this._state, fetches };
    this.notify("fetches");
  }

  prependError(e: TracedError): void {
    const errors = [e, ...this._state.errors.slice(0, CLIENT_MAX_REQUESTS - 1)];
    this._state = { ...this._state, errors };
    this.notify("errors");
  }

  prependLog(l: TracedLog): void {
    const logs = [l, ...this._state.logs.slice(0, CLIENT_MAX_REQUESTS - 1)];
    this._state = { ...this._state, logs };
    this.notify("logs");
  }

  prependQuery(q: TracedQuery): void {
    const queries = [q, ...this._state.queries.slice(0, CLIENT_MAX_REQUESTS - 1)];
    this._state = { ...this._state, queries };
    this.notify("queries");
  }

  setActiveView(view: DashboardView): void { this.setState("activeView", view); }

  setViewMode(mode: "simple" | "detailed"): void { this.setState("viewMode", mode); }

  clearAll(): void {
    this._state = {
      ...this._state,
      flows: [],
      requests: [],
      fetches: [],
      errors: [],
      logs: [],
      queries: [],
      issues: [],
      metrics: [],
    };
    this.notify("all");
  }

  private notify(key: StoreStateKey): void {
    this.dispatchEvent(new CustomEvent("state-changed", { detail: key }));
  }
}
