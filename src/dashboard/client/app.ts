/** Root <bk-dashboard> app shell component. */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { DashboardStore, dashboardContext } from "./store/dashboard-store.js";
import { SSEController } from "./controllers/sse-controller.js";
import { Toast } from "./components/toast.js";
import { copyAsCurl } from "./utils/curl.js";
import { fetchJSON } from "./utils/fetch.js";
import { pluralize } from "./utils/text.js";
import { isOpenIssue } from "./utils/issue-filters.js";
import { API, DASHBOARD_PREFIX, VIEW_TITLES, VIEW_SUBTITLES, UI_STRINGS } from "./constants.js";
import {
  iconOverview, iconActions, iconInsights, iconPerformance,
  iconGraph, iconExplorer,
} from "./components/icons.js";
import type { DashboardView, TracedRequest } from "./store/types.js";

@customElement("bk-dashboard")
export class Dashboard extends LitElement {
  @provide({ context: dashboardContext })
  store = new DashboardStore();

  @state() private activeView: DashboardView = "overview";
  @state() private viewMode: "simple" | "detailed" = "simple";

  private sse = new SSEController(this, this.store);
  private handleStateChanged = (e: Event) => {
    if ((e as CustomEvent).detail === "activeView") {
      this.activeView = this.store.state.activeView;
    }
    this.requestUpdate();
  };

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadInitialData();
    this.store.addEventListener("state-changed", this.handleStateChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.store.removeEventListener("state-changed", this.handleStateChanged);
  }

  private async loadInitialData() {
    try {
      const [flowsData, requestsData] = await Promise.all([
        fetchJSON<{ flows: unknown[] }>(API.flows),
        fetchJSON<{ requests: unknown[] }>(API.requests),
      ]);
      this.store.setFlows(flowsData.flows as never[]);
      this.store.setRequests(requestsData.requests as never[]);
    } catch (e) {
      console.warn("[brakit]", e);
    }

    try {
      const [fetchesData, errorsData, logsData, queriesData, metricsData] = await Promise.all([
        fetchJSON<{ entries: unknown[] }>(API.fetches),
        fetchJSON<{ entries: unknown[] }>(API.errors),
        fetchJSON<{ entries: unknown[] }>(API.logs),
        fetchJSON<{ entries: unknown[] }>(API.queries),
        fetchJSON<{ endpoints: unknown[] }>(API.metricsLive),
      ]);
      this.store.setFetches(fetchesData.entries as never[]);
      this.store.setErrors(errorsData.entries as never[]);
      this.store.setLogs(logsData.entries as never[]);
      this.store.setQueries(queriesData.entries as never[]);
      this.store.setMetrics((metricsData.endpoints || []) as never[]);
    } catch (e) {
      console.warn("[brakit]", e);
    }

    try {
      const insightsData = await fetchJSON<{ issues: unknown[] }>(API.insights);
      this.store.setIssues((insightsData.issues || []) as never[]);
    } catch (e) {
      console.warn("[brakit]", e);
    }
  }

  private switchView(view: DashboardView) {
    if (view === this.activeView) return;
    this.activeView = view;
    this.store.setActiveView(view);
    fetch(`${API.tab}?tab=${encodeURIComponent(view)}`).catch(() => {});
    if (view === "performance") {
      this.sse.reloadMetrics();
    }
  }

  private async handleClear() {
    if (!confirm(UI_STRINGS.CLEAR_CONFIRM)) return;
    await fetch(API.clear, { method: "POST" });
    this.store.clearAll();
    Toast.show(UI_STRINGS.CLEARED_TOAST);
  }

  handleCopyAsCurl(req: TracedRequest) {
    copyAsCurl(req);
  }

  render() {
    const state = this.store.state;
    const reqs = state.requests.filter((r) => !r.path?.startsWith(DASHBOARD_PREFIX));
    const errors = reqs.filter((r) => r.statusCode >= 400).length;
    const avg = reqs.length > 0 ? Math.round(reqs.reduce((sum, r) => sum + r.durationMs, 0) / reqs.length) : 0;
    const openIssues = (state.issues || []).filter(isOpenIssue).length;

    const config = window.__BRAKIT_CONFIG__;

    return html`
      <div class="app" id="app">
        <aside class="sidebar">
          <div class="sidebar-logo">
            <span class="logo-text">brakit</span>
            <span class="logo-version">v${config?.version ?? ""}</span>
          </div>
          <nav class="sidebar-nav">
            ${this.renderSidebarItem("overview", "Overview", iconOverview(), undefined)}
            ${this.renderSidebarItem("actions", "Actions", iconActions(), state.flows.length)}
            ${this.renderSidebarItem("insights", "Insights", iconInsights(), openIssues, openIssues === 0)}
            ${this.renderSidebarItem("performance", "Performance", iconPerformance(), undefined)}
            ${this.renderSidebarItem("graph", "Graph", iconGraph(), undefined)}
            <div class="sidebar-divider"></div>
            ${this.renderSidebarItem("explorer", "Explorer", iconExplorer(), reqs.length + state.fetches.length + state.queries.length + state.logs.length + state.errors.length)}
          </nav>
          <div class="sidebar-footer">:${config?.port ?? ""}</div>
        </aside>
        <div class="main-panel">
          <div class="header">
            <div class="header-left">
              <span class="header-title" id="header-title">${VIEW_TITLES[this.activeView] || this.activeView}</span>
              <span class="header-sub" id="header-sub">${VIEW_SUBTITLES[this.activeView] || ""}</span>
            </div>
            <div class="header-right">
              ${this.activeView === "actions" ? html`
                <div class="segmented-control" id="mode-toggle">
                  <button class="segmented-btn ${this.viewMode === "simple" ? "active" : ""}" @click=${() => { this.viewMode = "simple"; this.store.setViewMode("simple"); }}>Quick</button>
                  <button class="segmented-btn ${this.viewMode === "detailed" ? "active" : ""}" @click=${() => { this.viewMode = "detailed"; this.store.setViewMode("detailed"); }}>Detailed</button>
                </div>
              ` : nothing}
              <button class="btn btn-danger" @click=${this.handleClear}>Clear</button>
            </div>
          </div>
          <div class="main-content">
            <div style="display:${this.activeView === "overview" ? "block" : "none"}">
              <bk-overview-view></bk-overview-view>
            </div>
            <div style="display:${this.activeView === "actions" ? "block" : "none"}">
              <bk-flows-view></bk-flows-view>
            </div>
            <div style="display:${this.activeView === "insights" ? "block" : "none"}">
              <bk-insights-view></bk-insights-view>
            </div>
            <div style="display:${this.activeView === "performance" ? "block" : "none"}">
              <bk-performance-view></bk-performance-view>
            </div>
            <div style="display:${this.activeView === "graph" ? "block" : "none"}">
              <bk-graph-view></bk-graph-view>
            </div>
            <div style="display:${this.activeView === "explorer" ? "block" : "none"}">
              <bk-explorer-view></bk-explorer-view>
            </div>
          </div>
          <div class="footer">
            <span id="stat-total">${reqs.length} ${pluralize(reqs.length, "request")}</span>
            <span id="stat-flows">${state.flows.length} ${pluralize(state.flows.length, "action")}</span>
            <span id="stat-errors" class="error-count">${errors} ${pluralize(errors, "error")}</span>
            <span id="stat-avg">Avg: ${avg}ms</span>
          </div>
        </div>
      </div>
      <bk-toast></bk-toast>
    `;
  }

  private renderSidebarItem(view: DashboardView, label: string, icon: TemplateResult, count?: number, hideCount = false) {
    return html`
      <button class="sidebar-item ${this.activeView === view ? "active" : ""}" @click=${() => this.switchView(view)}>
        <span class="item-icon">${icon}</span>
        <span class="item-label">${label}</span>
        ${count !== undefined ? html`<span class="item-count" style="display:${hideCount ? "none" : ""}">${count}</span>` : nothing}
      </button>
    `;
  }
}
