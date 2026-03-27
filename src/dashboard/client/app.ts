/** Root <bk-dashboard> app shell component. */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provide } from "@lit/context";
import { DashboardStore, dashboardContext } from "./store/dashboard-store.js";
import { SSEController } from "./controllers/sse-controller.js";
import { Toast } from "./components/toast.js";
import { copyAsCurl } from "./utils/curl.js";
import { API, DASHBOARD_PREFIX, VIEW_TITLES, VIEW_SUBTITLES } from "./constants.js";
import {
  iconOverview, iconActions, iconRequests, iconFetches,
  iconQueries, iconErrors, iconLogs, iconSecurity, iconPerformance, iconGraph,
} from "./components/icons.js";
import type { TracedRequest } from "./store/types.js";

@customElement("bk-dashboard")
export class Dashboard extends LitElement {
  @provide({ context: dashboardContext })
  store = new DashboardStore();

  @state() private activeView = "overview";
  @state() private viewMode: "simple" | "detailed" = "simple";

  private sse = new SSEController(this, this.store);

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadInitialData();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  private async loadInitialData() {
    try {
      const [flowsRes, requestsRes] = await Promise.all([
        fetch(API.flows),
        fetch(API.requests),
      ]);
      const [flowsData, requestsData] = await Promise.all([
        flowsRes.json(),
        requestsRes.json(),
      ]);
      this.store.setFlows(flowsData.flows);
      this.store.setRequests(requestsData.requests);
    } catch (e) {
      console.warn("[brakit]", e);
    }

    try {
      const [fetchesRes, errorsRes, logsRes, queriesRes, metricsRes] = await Promise.all([
        fetch(API.fetches),
        fetch(API.errors),
        fetch(API.logs),
        fetch(API.queries),
        fetch(API.metricsLive),
      ]);
      const [fetchesData, errorsData, logsData, queriesData, metricsData] = await Promise.all([
        fetchesRes.json(),
        errorsRes.json(),
        logsRes.json(),
        queriesRes.json(),
        metricsRes.json(),
      ]);
      this.store.setFetches(fetchesData.entries);
      this.store.setErrors(errorsData.entries);
      this.store.setLogs(logsData.entries);
      this.store.setQueries(queriesData.entries);
      this.store.setMetrics(metricsData.endpoints || []);
    } catch (e) {
      console.warn("[brakit]", e);
    }

    try {
      const insightsRes = await fetch(API.insights);
      const insightsData = await insightsRes.json();
      this.store.setIssues(insightsData.issues || []);
    } catch (e) {
      console.warn("[brakit]", e);
    }
  }

  private switchView(view: string) {
    if (view === this.activeView) return;
    this.activeView = view;
    this.store.setActiveView(view);
    fetch(`${API.tab}?tab=${encodeURIComponent(view)}`).catch(() => {});
    if (view === "performance") {
      this.sse.reloadMetrics();
    }
  }

  private async handleClear() {
    if (!confirm("This will clear all data including performance metrics history. Continue?")) return;
    await fetch(API.clear, { method: "POST" });
    this.store.clearAll();
    Toast.show("Cleared");
  }

  handleCopyAsCurl(req: TracedRequest) {
    copyAsCurl(req);
  }

  render() {
    const s = this.store.state;
    const reqs = s.requests.filter((r) => !r.path?.startsWith(DASHBOARD_PREFIX));
    const errors = reqs.filter((r) => r.statusCode >= 400).length;
    const avg = reqs.length > 0 ? Math.round(reqs.reduce((sum, r) => sum + r.durationMs, 0) / reqs.length) : 0;
    const openIssues = (s.issues || []).filter((f) => f.state !== "resolved" && f.state !== "stale").length;

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
            <div class="sidebar-section">Monitor</div>
            ${this.renderSidebarItem("actions", "Actions", iconActions(), s.flows.length)}
            ${this.renderSidebarItem("requests", "Requests", iconRequests(), reqs.length)}
            ${this.renderSidebarItem("fetches", "Fetches", iconFetches(), s.fetches.length)}
            <div class="sidebar-section">Insights</div>
            ${this.renderSidebarItem("queries", "Queries", iconQueries(), s.queries.length)}
            ${this.renderSidebarItem("errors", "Errors", iconErrors(), s.errors.length)}
            ${this.renderSidebarItem("logs", "Logs", iconLogs(), s.logs.length)}
            ${this.renderSidebarItem("security", "Security", iconSecurity(), openIssues, openIssues === 0)}
            ${this.renderSidebarItem("performance", "Performance", iconPerformance(), undefined)}
            <div class="sidebar-section">Topology</div>
            <button class="sidebar-item ${this.activeView === "graph" ? "active" : ""}" @click=${() => this.switchView("graph")}>
              <span class="item-icon">${iconGraph()}</span>
              <span class="item-label">Graph</span>
              <span class="sidebar-beta">beta</span>
            </button>
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
            <div id="overview-container" style="display:${this.activeView === "overview" ? "block" : "none"}">
              <bk-overview-view></bk-overview-view>
            </div>
            <div class="view-flows" id="flow-container" style="display:${this.activeView === "actions" ? "block" : "none"}">
              <bk-flows-view></bk-flows-view>
            </div>
            <div class="view-requests" id="request-container" style="display:${this.activeView === "requests" ? "block" : "none"}">
              <bk-requests-view></bk-requests-view>
            </div>
            <div class="view-telemetry" id="fetch-container" style="display:${this.activeView === "fetches" ? "block" : "none"}">
              <bk-fetches-view></bk-fetches-view>
            </div>
            <div class="view-telemetry" id="query-container" style="display:${this.activeView === "queries" ? "block" : "none"}">
              <bk-queries-view></bk-queries-view>
            </div>
            <div class="view-telemetry" id="error-container" style="display:${this.activeView === "errors" ? "block" : "none"}">
              <bk-errors-view></bk-errors-view>
            </div>
            <div class="view-telemetry" id="log-container" style="display:${this.activeView === "logs" ? "block" : "none"}">
              <bk-logs-view></bk-logs-view>
            </div>
            <div class="view-telemetry" id="security-container" style="display:${this.activeView === "security" ? "block" : "none"}">
              <bk-security-view></bk-security-view>
            </div>
            <div class="view-telemetry" id="performance-container" style="display:${this.activeView === "performance" ? "block" : "none"}">
              <bk-performance-view></bk-performance-view>
            </div>
            <div class="view-telemetry" id="graph-container" style="display:${this.activeView === "graph" ? "block" : "none"}">
              <bk-graph-view></bk-graph-view>
            </div>
          </div>
          <div class="footer">
            <span id="stat-total">${reqs.length} request${reqs.length !== 1 ? "s" : ""}</span>
            <span id="stat-flows">${s.flows.length} action${s.flows.length !== 1 ? "s" : ""}</span>
            <span id="stat-errors" class="error-count">${errors} error${errors !== 1 ? "s" : ""}</span>
            <span id="stat-avg">Avg: ${avg}ms</span>
          </div>
        </div>
      </div>
      <bk-toast></bk-toast>
    `;
  }

  private renderSidebarItem(view: string, label: string, icon: unknown, count?: number, hideCount = false) {
    return html`
      <button class="sidebar-item ${this.activeView === view ? "active" : ""}" @click=${() => this.switchView(view)}>
        <span class="item-icon">${icon}</span>
        <span class="item-label">${label}</span>
        ${count !== undefined ? html`<span class="item-count" style="display:${hideCount ? "none" : ""}">${count}</span>` : nothing}
      </button>
    `;
  }
}
