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

export class SSEController implements ReactiveController {
  private eventSource?: EventSource;
  private reloadTimer?: ReturnType<typeof setTimeout>;
  private perfReloadTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private retryCount = 0;

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
    this.eventSource?.close();
    clearTimeout(this.reloadTimer);
    clearTimeout(this.perfReloadTimer);
    clearTimeout(this.reconnectTimer);
  }

  private connect(): void {
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
      const req = JSON.parse(e.data);
      if (req.path?.startsWith(DASHBOARD_PREFIX)) return;
      this.store.prependRequest(req);
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => this.reloadFlows(), CLIENT_RELOAD_DEBOUNCE_MS);
      if (this.store.state.activeView === "performance") {
        clearTimeout(this.perfReloadTimer);
        this.perfReloadTimer = setTimeout(() => this.reloadMetrics(), PERF_RELOAD_DEBOUNCE_MS);
      }
    };

    this.eventSource.addEventListener(SSE_EVENT_FETCH, (e) => {
      this.store.prependFetch(JSON.parse((e as MessageEvent).data));
    });
    this.eventSource.addEventListener(SSE_EVENT_LOG, (e) => {
      this.store.prependLog(JSON.parse((e as MessageEvent).data));
    });
    this.eventSource.addEventListener(SSE_EVENT_ERROR, (e) => {
      this.store.prependError(JSON.parse((e as MessageEvent).data));
    });
    this.eventSource.addEventListener(SSE_EVENT_QUERY, (e) => {
      this.store.prependQuery(JSON.parse((e as MessageEvent).data));
    });
    this.eventSource.addEventListener(SSE_EVENT_ISSUES, (e) => {
      this.store.setIssues(JSON.parse((e as MessageEvent).data));
    });
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
