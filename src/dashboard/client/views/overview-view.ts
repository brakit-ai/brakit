/** <bk-overview-view> — Dashboard landing with feature summary cards. */

import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { BkViewBase } from "./bk-view-base.js";
import { formatDuration } from "../utils/format.js";
import { fetchJSON } from "../utils/fetch.js";
import { pluralize } from "../utils/text.js";
import { isOpenIssue } from "../utils/issue-filters.js";
import { DASHBOARD_PREFIX, API } from "../constants.js";
import { SLOW_REQUEST_THRESHOLD_MS } from "../constants/thresholds.js";
import { UI_STRINGS } from "../constants/ui-strings.js";
import type { DashboardView, FlowData, StatefulIssue, TracedRequest, GraphSummary } from "../store/types.js";

@customElement("bk-overview-view")
export class OverviewView extends BkViewBase {
  @state() private graphSummary: GraphSummary | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadGraphSummary();
  }

  private async loadGraphSummary() {
    try {
      const data = await fetchJSON<{ nodes: { type: string }[] }>(`${API.graph}?level=endpoints`);
      const nodes = data.nodes || [];
      this.graphSummary = {
        endpoints: nodes.filter((n) => n.type === "endpoint").length,
        tables: nodes.filter((n) => n.type === "table").length,
        externals: nodes.filter((n) => n.type === "external").length,
      };
    } catch { /* non-critical */ }
  }

  private navigateTo(view: DashboardView) {
    this.store.setActiveView(view);
  }

  private navigateToExplorerErrors() {
    this.store.setActiveView("explorer");
    window.dispatchEvent(new CustomEvent("navigate-explorer", { detail: "errors" }));
  }

  render() {
    const state = this.store.state;
    const nonStatic = state.requests.filter(
      (r) => !r.isStatic && !r.isHealthCheck && (!r.path || r.path.indexOf(DASHBOARD_PREFIX) !== 0),
    );
    const hasAnyData = nonStatic.length > 0 || state.queries.length > 0;

    if (!hasAnyData) {
      return html`<bk-empty-state
        title="${UI_STRINGS.EMPTY_TITLE}"
        subtitle="${UI_STRINGS.EMPTY_SUBTITLE_OVERVIEW}"
      ></bk-empty-state>`;
    }

    return html`
      <div class="ov-container">
        <div class="ov-grid">
          ${this.renderActionsCard(state.flows)}
          ${this.renderInsightsCard(state.issues)}
          ${this.renderPerformanceCard(nonStatic)}
          ${this.renderErrorsCard(nonStatic)}
          ${this.renderGraphCard()}
        </div>
      </div>
    `;
  }

  private renderActionsCard(flows: FlowData[]) {
    const count = flows.length;
    if (count === 0) {
      return this.renderEmptyCard("\u25B6", "Actions", UI_STRINGS.NO_ACTIONS, "actions");
    }
    const avgMs = Math.round(flows.reduce((sum, flow) => sum + flow.totalDurationMs, 0) / count);
    const topFlow = flows[0]?.label || "";
    return this.renderCard("\u25B6", `${count} ${pluralize(count, "action")}`, `avg ${formatDuration(avgMs)}${topFlow ? ` \u00B7 "${topFlow}"` : ""}`, "actions", "var(--accent)");
  }

  private renderInsightsCard(issues: StatefulIssue[]) {
    const open = (issues || []).filter(isOpenIssue);
    if (open.length === 0) {
      return this.renderCard("\u2713", UI_STRINGS.ALL_CLEAR, UI_STRINGS.ALL_CLEAR_DETAIL, "insights", "var(--green)");
    }
    const critical = open.filter((entry) => entry.issue.severity === "critical").length;
    const warning = open.filter((entry) => entry.issue.severity === "warning").length;
    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical} critical`);
    if (warning > 0) parts.push(`${warning} warning`);
    return this.renderCard("\uD83D\uDCA1", `${open.length} ${pluralize(open.length, "issue")}`, parts.join(" \u00B7 ") || UI_STRINGS.REVIEW_RECOMMENDED, "insights", "var(--amber)");
  }

  private renderPerformanceCard(requests: TracedRequest[]) {
    if (requests.length === 0) {
      return this.renderEmptyCard("\u26A1", "Performance", UI_STRINGS.NO_REQUEST_DATA, "performance");
    }
    const endpointLatency = new Map<string, number[]>();
    for (const req of requests) {
      const key = `${req.method} ${req.path}`;
      let arr = endpointLatency.get(key);
      if (!arr) { arr = []; endpointLatency.set(key, arr); }
      arr.push(req.durationMs);
    }
    const slowEndpoints: { key: string; avg: number }[] = [];
    for (const [key, durations] of endpointLatency) {
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      if (avg > SLOW_REQUEST_THRESHOLD_MS) slowEndpoints.push({ key, avg });
    }
    slowEndpoints.sort((a, b) => b.avg - a.avg);

    if (slowEndpoints.length === 0) {
      return this.renderCard("\u26A1", UI_STRINGS.ALL_FAST, UI_STRINGS.NO_SLOW_ENDPOINTS, "performance", "var(--green)");
    }
    const worst = slowEndpoints[0];
    return this.renderCard("\u26A1", `${slowEndpoints.length} slow ${pluralize(slowEndpoints.length, "endpoint")}`, `worst: ${worst.key} \u00B7 ${formatDuration(worst.avg)}`, "performance", "var(--amber)");
  }

  private renderErrorsCard(requests: TracedRequest[]) {
    const errors = requests.filter((r) => r.statusCode >= 400);
    if (errors.length === 0) {
      return this.renderCard("\u2713", UI_STRINGS.ZERO_ERRORS, UI_STRINGS.ALL_REQUESTS_OK, "explorer", "var(--green)");
    }
    const byStatus = new Map<number, number>();
    for (const req of errors) {
      byStatus.set(req.statusCode, (byStatus.get(req.statusCode) || 0) + 1);
    }
    const parts = [...byStatus.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => `${count}\u00D7 ${code}`);

    return html`
      <div class="ov-card-nav" @click=${() => this.navigateToExplorerErrors()}>
        <div class="ov-card-icon-lg" style="color:var(--red)">\u2715</div>
        <div class="ov-card-content">
          <div class="ov-card-headline">${errors.length} ${pluralize(errors.length, "error")}</div>
          <div class="ov-card-context">${parts.join(" \u00B7 ")}</div>
        </div>
        <span class="ov-card-arrow">\u2192</span>
      </div>
    `;
  }

  private renderGraphCard() {
    const graph = this.graphSummary;
    if (!graph || (graph.endpoints === 0 && graph.tables === 0)) {
      return this.renderEmptyCard("\u25CE", "Graph", UI_STRINGS.BUILD_GRAPH, "graph");
    }
    const parts: string[] = [];
    if (graph.endpoints > 0) parts.push(`${graph.endpoints} ${pluralize(graph.endpoints, "endpoint")}`);
    if (graph.tables > 0) parts.push(`${graph.tables} ${pluralize(graph.tables, "table")}`);
    const context = graph.externals > 0 ? `${graph.externals} external ${pluralize(graph.externals, "service")}` : "";
    return this.renderCard("\u25CE", parts.join(" \u00B7 "), context, "graph", "var(--accent)");
  }

  private renderCard(icon: string, headline: string, context: string, target: DashboardView, color: string) {
    return html`
      <div class="ov-card-nav" @click=${() => this.navigateTo(target)}>
        <div class="ov-card-icon-lg" style="color:${color}">${icon}</div>
        <div class="ov-card-content">
          <div class="ov-card-headline">${headline}</div>
          ${context ? html`<div class="ov-card-context">${context}</div>` : nothing}
        </div>
        <span class="ov-card-arrow">\u2192</span>
      </div>
    `;
  }

  private renderEmptyCard(icon: string, label: string, context: string, target: DashboardView) {
    return html`
      <div class="ov-card-nav ov-card-empty" @click=${() => this.navigateTo(target)}>
        <div class="ov-card-icon-lg">${icon}</div>
        <div class="ov-card-content">
          <div class="ov-card-headline">${label}</div>
          <div class="ov-card-context">${context}</div>
        </div>
        <span class="ov-card-arrow">\u2192</span>
      </div>
    `;
  }
}
