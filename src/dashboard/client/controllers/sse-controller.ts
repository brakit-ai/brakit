/** SSE reactive controller — manages EventSource connection and pushes data into the store. */

import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { DashboardStore } from "../store/dashboard-store.js";
import {
  CLIENT_RELOAD_DEBOUNCE_MS,
  PERF_RELOAD_DEBOUNCE_MS,
  SSE_RECONNECT_BASE_MS,
  SSE_RECONNECT_MAX_MS,
  SSE_MAX_RETRIES,
  SSE_EVENT_FETCH,
  SSE_EVENT_LOG,
  SSE_EVENT_ERROR,
  SSE_EVENT_QUERY,
  SSE_EVENT_ISSUES,
  DASHBOARD_PREFIX,
  API,
} from "../constants.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE payloads are untyped at the boundary
function safeParse(data: string): any {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export class SSEController implements ReactiveController {
  private eventSource?: EventSource;
  private reloadTimer?: ReturnType<typeof setTimeout>;
  private perfReloadTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private retryCount = 0;

  private readonly boundHandlers = {
    fetch: (e: Event) => {
      const data = safeParse((e as MessageEvent).data);
      if (data) this.store.prependFetch(data);
    },
    log: (e: Event) => {
      const data = safeParse((e as MessageEvent).data);
      if (data) this.store.prependLog(data);
    },
    error: (e: Event) => {
      const data = safeParse((e as MessageEvent).data);
      if (data) this.store.prependError(data);
    },
    query: (e: Event) => {
      const data = safeParse((e as MessageEvent).data);
      if (data) this.store.prependQuery(data);
    },
    issues: (e: Event) => {
      const data = safeParse((e as MessageEvent).data);
      if (data) this.store.setIssues(data);
    },
  };

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private store: DashboardStore,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.connect();
  }

  hostDisconnected(): void {
    this.removeListeners();
    this.eventSource?.close();
    clearTimeout(this.reloadTimer);
    clearTimeout(this.perfReloadTimer);
    clearTimeout(this.reconnectTimer);
  }

  private removeListeners(): void {
    if (!this.eventSource) return;
    this.eventSource.removeEventListener(SSE_EVENT_FETCH, this.boundHandlers.fetch);
    this.eventSource.removeEventListener(SSE_EVENT_LOG, this.boundHandlers.log);
    this.eventSource.removeEventListener(SSE_EVENT_ERROR, this.boundHandlers.error);
    this.eventSource.removeEventListener(SSE_EVENT_QUERY, this.boundHandlers.query);
    this.eventSource.removeEventListener(SSE_EVENT_ISSUES, this.boundHandlers.issues);
  }

  private connect(): void {
    this.removeListeners();
    this.eventSource?.close();
    this.eventSource = new EventSource(API.events);

    this.eventSource.onopen = () => {
      this.retryCount = 0;
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.scheduleReconnect();
    };

    this.eventSource.onmessage = (e) => {
      const req = safeParse(e.data);
      if (!req) return;
      if ((req as { path?: string }).path?.startsWith(DASHBOARD_PREFIX)) return;
      this.store.prependRequest(req);
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => this.reloadFlows(), CLIENT_RELOAD_DEBOUNCE_MS);
      if (this.store.state.activeView === "performance") {
        clearTimeout(this.perfReloadTimer);
        this.perfReloadTimer = setTimeout(() => this.reloadMetrics(), PERF_RELOAD_DEBOUNCE_MS);
      }
    };

    this.eventSource.addEventListener(SSE_EVENT_FETCH, this.boundHandlers.fetch);
    this.eventSource.addEventListener(SSE_EVENT_LOG, this.boundHandlers.log);
    this.eventSource.addEventListener(SSE_EVENT_ERROR, this.boundHandlers.error);
    this.eventSource.addEventListener(SSE_EVENT_QUERY, this.boundHandlers.query);
    this.eventSource.addEventListener(SSE_EVENT_ISSUES, this.boundHandlers.issues);
  }

  /** Exponential backoff: base * 2^retry, capped at max. */
  private scheduleReconnect(): void {
    if (this.retryCount >= SSE_MAX_RETRIES) return;
    const delay = Math.min(SSE_RECONNECT_BASE_MS * 2 ** this.retryCount, SSE_RECONNECT_MAX_MS);
    this.retryCount++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private async reloadFlows(): Promise<void> {
    try {
      const res = await fetch(API.flows);
      const data = await res.json();
      this.store.setFlows(data.flows);
    } catch {
      // Non-critical; SSE will push updates
    }
  }

  async reloadMetrics(): Promise<void> {
    try {
      const res = await fetch(API.metricsLive);
      const data = await res.json();
      this.store.setMetrics(data.endpoints || []);
    } catch {
      // Non-critical
    }
  }
}
