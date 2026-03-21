/** <bk-performance-view> — Endpoint performance dashboard with heat map and drill-down. */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { formatDuration } from "../utils/format.js";
import {
  ALL_ENDPOINTS_SELECTOR,
  GRAPH_COLORS,
  HIGH_QUERY_COUNT_PER_REQ,
  API,
} from "../constants.js";
import {
  HISTORY_TABLE_LIMIT,
  RECENT_SESSIONS_LIMIT,
  QUERY_BREAKDOWN_REQUEST_LIMIT,
  CLICK_TOLERANCE_PX,
} from "../constants/layout.js";
import type { HealthGrade } from "../constants.js";
import type {
  LiveRequestPoint,
  LiveEndpointData,
  LiveEndpointSummary,
  TracedRequest,
  FlowActivityData,
} from "../store/types.js";
import { drawScatterChart, type ScatterDot } from "../utils/scatter-chart.js";
import { adaptiveHealthGrade, representativeLatency } from "../utils/health.js";

interface QueryShapeAggregate {
  label: string;
  totalMs: number;
  count: number;
  avgMs: number;
}

interface CallerInfo {
  label: string;
  count: number;
  avgMs: number;
}

@customElement("bk-performance-view")
export class PerformanceView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private selectedEndpoint: string = ALL_ENDPOINTS_SELECTOR;
  @state() private graphData: LiveEndpointData[] = [];
  @state() private loadError = false;
  @state() private queryBreakdown: QueryShapeAggregate[] = [];
  @state() private queryBreakdownLoading = false;

  private scatterDots: ScatterDot[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
    this.loadMetrics();
  }

  private async loadMetrics() {
    try {
      const response = await fetch(API.metricsLive);
      const json = await response.json();
      this.graphData = json.endpoints || [];
      this.loadError = false;
      if (!this.selectedEndpoint || this.selectedEndpoint === ALL_ENDPOINTS_SELECTOR) {
        this.selectedEndpoint = ALL_ENDPOINTS_SELECTOR;
      }
    } catch {
      this.loadError = true;
    }
  }

  private healthGradeForEndpoint(endpoint: LiveEndpointData): HealthGrade {
    const latency = representativeLatency(
      endpoint.summary.p95Ms,
      endpoint.summary.medianMs,
      endpoint.summary.totalRequests,
    );
    return adaptiveHealthGrade(latency, endpoint.baselineP95Ms);
  }

  private healthGradeForDuration(durationMs: number, baseline?: number | null): HealthGrade {
    return adaptiveHealthGrade(durationMs, baseline);
  }

  private getCallers(endpointKey: string): CallerInfo[] {
    const flows = this.store.state.flows;
    const callerMap = new Map<string, { count: number; totalMs: number }>();

    for (const flow of flows) {
      for (const request of flow.requests) {
        const requestKey = `${request.method} ${request.path}`;
        if (requestKey === endpointKey || this.normalizeEndpoint(request) === endpointKey) {
          const existing = callerMap.get(flow.label);
          if (existing) {
            existing.count++;
            existing.totalMs += request.durationMs;
          } else {
            callerMap.set(flow.label, { count: 1, totalMs: request.durationMs });
          }
        }
      }
    }

    return [...callerMap.entries()]
      .map(([label, stats]) => ({
        label,
        count: stats.count,
        avgMs: Math.round(stats.totalMs / stats.count),
      }))
      .sort((a, b) => b.count - a.count);
  }

  private normalizeEndpoint(request: TracedRequest): string {
    const normalized = request.path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/\d+/g, "/:id");
    return `${request.method} ${normalized}`;
  }

  private async loadQueryBreakdown(endpointKey: string) {
    if (this.queryBreakdownLoading) return;

    const allRequests = this.store.state.requests;
    const matchingIds = allRequests
      .filter((request: TracedRequest) => {
        const key = `${request.method} ${request.path}`;
        return key === endpointKey || this.normalizeEndpoint(request) === endpointKey;
      })
      .slice(-QUERY_BREAKDOWN_REQUEST_LIMIT)
      .map((request: TracedRequest) => request.id)
      .filter(Boolean);

    if (matchingIds.length === 0) {
      this.queryBreakdown = [];
      return;
    }

    this.queryBreakdownLoading = true;
    try {
      const response = await fetch(`${API.activity}?requestIds=${matchingIds.join(",")}`);
      if (!response.ok) {
        this.queryBreakdownLoading = false;
        return;
      }
      const activityData: FlowActivityData = await response.json();

      const shapeMap = new Map<string, { label: string; totalMs: number; count: number }>();
      for (const activity of Object.values(activityData.activities)) {
        for (const event of activity.timeline) {
          if (event.type !== "query") continue;
          const query = event.data;
          const operation = (query.normalizedOp || query.operation || "QUERY").toUpperCase();
          const table = query.table || query.model || "";
          const label = `${operation} ${table}`.trim();
          const existing = shapeMap.get(label);
          if (existing) {
            existing.totalMs += query.durationMs;
            existing.count++;
          } else {
            shapeMap.set(label, { label, totalMs: query.durationMs, count: 1 });
          }
        }
      }

      this.queryBreakdown = [...shapeMap.values()]
        .map((shape) => ({ ...shape, avgMs: Math.round(shape.totalMs / shape.count) }))
        .sort((a, b) => b.totalMs - a.totalMs);
    } catch {
      // Retry available by re-selecting the endpoint
    }
    this.queryBreakdownLoading = false;
  }

  private renderScatterChart(canvas: HTMLCanvasElement, requests: LiveRequestPoint[]) {
    this.scatterDots = drawScatterChart(canvas, requests);
    canvas.style.cursor = "pointer";
    canvas.onclick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      let closestDot: ScatterDot | null = null;
      let closestDist = Infinity;
      for (const dot of this.scatterDots) {
        const dist = Math.sqrt((dot.x - mouseX) ** 2 + (dot.y - mouseY) ** 2);
        if (dist < closestDist) { closestDist = dist; closestDot = dot; }
      }
      if (closestDot && closestDist < CLICK_TOLERANCE_PX) this.highlightRow(closestDot.idx);
    };
  }

  private highlightRow(requestIndex: number) {
    const previousHighlight = this.querySelector(".perf-hist-row-hl");
    if (previousHighlight) previousHighlight.classList.remove("perf-hist-row-hl");
    const row = this.querySelector(`[data-req-idx="${requestIndex}"]`);
    if (row) {
      row.classList.add("perf-hist-row-hl");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  updated() {
    if (this.selectedEndpoint === ALL_ENDPOINTS_SELECTOR) return;
    const canvas = this.querySelector<HTMLCanvasElement>("#perf-detail-canvas");
    if (canvas) {
      const endpointData = this.graphData.find((item) => item.endpoint === this.selectedEndpoint);
      if (endpointData) this.renderScatterChart(canvas, endpointData.requests);
    }
  }

  render() {
    if (!this.graphData || this.graphData.length === 0) {
      return html`<bk-empty-state title="No performance data yet" subtitle="Hit some endpoints and data will appear here"></bk-empty-state>`;
    }

    return html`
      <div id="graph-content">
        ${this.renderSelector()}
        ${this.selectedEndpoint === ALL_ENDPOINTS_SELECTOR ? this.renderOverview() : this.renderDetail()}
      </div>
    `;
  }

  private renderSelector() {
    return html`
      <div class="perf-selector">
        <button class="perf-selector-btn ${this.selectedEndpoint === ALL_ENDPOINTS_SELECTOR ? "active" : ""}"
          @click=${() => { this.selectedEndpoint = ALL_ENDPOINTS_SELECTOR; }}>Overview</button>
        ${this.graphData.map((endpointData, index) => html`
          <button class="perf-selector-btn ${endpointData.endpoint === this.selectedEndpoint ? "active" : ""}"
            @click=${() => { this.selectedEndpoint = endpointData.endpoint; this.queryBreakdown = []; this.loadQueryBreakdown(endpointData.endpoint); }}>
            <span class="perf-dot" style="background:${GRAPH_COLORS[index % GRAPH_COLORS.length]}"></span>${endpointData.endpoint}
          </button>
        `)}
      </div>
    `;
  }

  private renderOverview() {
    const activeEndpoints = this.graphData.filter((endpoint) => endpoint.requests.length > 0);
    if (activeEndpoints.length === 0) return nothing;

    const totalRequests = activeEndpoints.reduce((sum, endpoint) => sum + endpoint.summary.totalRequests, 0);
    const weightedP95 = totalRequests > 0
      ? Math.round(activeEndpoints.reduce((sum, endpoint) => sum + endpoint.summary.p95Ms * endpoint.summary.totalRequests, 0) / totalRequests)
      : 0;
    const totalErrors = activeEndpoints.reduce((sum, endpoint) => sum + Math.round(endpoint.summary.errorRate * endpoint.summary.totalRequests), 0);
    const overallErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const slowestEndpoint = activeEndpoints[0];

    return html`
      <div class="perf-overview">
        <div class="perf-summary-row">
          <div class="perf-summary-card">
            <span class="perf-summary-label">Total Requests</span>
            <span class="perf-summary-value">${totalRequests}</span>
          </div>
          <div class="perf-summary-card">
            <span class="perf-summary-label">Avg P95</span>
            <span class="perf-summary-value" style="color:${this.healthGradeForDuration(weightedP95).color}">${formatDuration(weightedP95)}</span>
          </div>
          <div class="perf-summary-card">
            <span class="perf-summary-label">Error Rate</span>
            <span class="perf-summary-value" style="color:${totalErrors > 0 ? "var(--red)" : "var(--green)"}">${Math.round(overallErrorRate * 100)}%</span>
          </div>
          <div class="perf-summary-card">
            <span class="perf-summary-label">Slowest</span>
            <span class="perf-summary-value perf-summary-value-sm">${slowestEndpoint?.endpoint ?? "-"}</span>
          </div>
        </div>

        <table class="perf-table perf-heatmap">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th class="perf-th-right">Calls</th>
              <th class="perf-th-center">P95</th>
              <th class="perf-th-center">Errors</th>
              <th class="perf-th-center">Q/Req</th>
              <th>Time Split</th>
            </tr>
          </thead>
          <tbody>
            ${activeEndpoints.map((endpoint) => this.renderHeatmapRow(endpoint))}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderHeatmapRow(endpoint: LiveEndpointData) {
    const summary = endpoint.summary;
    const grade = this.healthGradeForEndpoint(endpoint);
    const errorCount = Math.round(summary.errorRate * summary.totalRequests);
    const totalAvgMs = (summary.avgQueryTimeMs || 0) + (summary.avgFetchTimeMs || 0) + (summary.avgAppTimeMs || 0);

    let dbPct = 0, fetchPct = 0, appPct = 100;
    if (totalAvgMs > 0) {
      dbPct = Math.round(((summary.avgQueryTimeMs || 0) / totalAvgMs) * 100);
      fetchPct = Math.round(((summary.avgFetchTimeMs || 0) / totalAvgMs) * 100);
      appPct = Math.max(0, 100 - dbPct - fetchPct);
    }

    return html`
      <tr class="perf-table-row" @click=${() => { this.selectedEndpoint = endpoint.endpoint; this.queryBreakdown = []; this.loadQueryBreakdown(endpoint.endpoint); }}>
        <td class="perf-td-name">${endpoint.endpoint}</td>
        <td class="perf-td-right">${summary.totalRequests}</td>
        <td class="perf-td-center">
          <span class="perf-hm-p95" style="color:${grade.color};background:${grade.bg};border-color:${grade.border}">${formatDuration(summary.p95Ms)}</span>
        </td>
        <td class="perf-td-center" style="color:${errorCount > 0 ? "var(--red)" : "var(--text-muted)"}">${errorCount > 0 ? errorCount : "-"}</td>
        <td class="perf-td-center" style="color:${summary.avgQueryCount > HIGH_QUERY_COUNT_PER_REQ ? "var(--amber)" : "var(--text-muted)"}">${summary.avgQueryCount}</td>
        <td>
          <span class="perf-hm-split-bar">
            ${dbPct > 0 ? html`<span class="perf-breakdown-seg perf-breakdown-db" style="width:${dbPct}%"></span>` : nothing}
            ${fetchPct > 0 ? html`<span class="perf-breakdown-seg perf-breakdown-fetch" style="width:${fetchPct}%"></span>` : nothing}
            ${appPct > 0 ? html`<span class="perf-breakdown-seg perf-breakdown-app" style="width:${appPct}%"></span>` : nothing}
          </span>
        </td>
      </tr>
    `;
  }

  private renderDetail() {
    const endpointData = this.graphData.find((item) => item.endpoint === this.selectedEndpoint);
    if (!endpointData?.requests?.length) {
      return html`<bk-empty-state subtitle="No data for this endpoint"></bk-empty-state>`;
    }

    const summary = endpointData.summary;
    const grade = this.healthGradeForEndpoint(endpointData);
    const errorCount = Math.round(summary.errorRate * summary.totalRequests);

    return html`
      ${this.renderDetailHeader(endpointData, grade)}
      ${this.renderDetailMetrics(summary, grade, errorCount)}
      ${this.renderDetailBreakdown(summary)}
      ${this.renderCallers(endpointData.endpoint)}
      ${this.renderQueryBreakdown()}
      ${this.renderTrends(endpointData)}
      ${this.renderDetailChart()}
      ${this.renderDetailHistory(endpointData)}
    `;
  }

  private renderDetailHeader(endpointData: LiveEndpointData, grade: HealthGrade) {
    return html`
      <div class="perf-detail-header">
        <div class="perf-detail-title">
          <span class="perf-badge perf-badge-lg" style="color:${grade.color};background:${grade.bg};border-color:${grade.border}">${grade.label}</span>
          <span>${endpointData.endpoint}</span>
          ${endpointData.baselineP95Ms ? html`<span class="perf-baseline-hint">Baseline: ${formatDuration(endpointData.baselineP95Ms)}</span>` : nothing}
        </div>
      </div>
    `;
  }

  private renderDetailMetrics(summary: LiveEndpointSummary, grade: HealthGrade, errorCount: number) {
    return html`
      <div class="perf-metric-row">
        <div class="perf-metric-card">
          <span class="perf-metric-label">P95</span>
          <span class="perf-metric-value" style="color:${grade.color}">${formatDuration(summary.p95Ms)}</span>
        </div>
        <div class="perf-metric-card">
          <span class="perf-metric-label">Errors</span>
          <span class="perf-metric-value" style="color:${errorCount > 0 ? "var(--red)" : "var(--green)"}">
            ${errorCount > 0 ? errorCount + " (" + Math.round(summary.errorRate * 100) + "%)" : "0"}
          </span>
        </div>
        <div class="perf-metric-card">
          <span class="perf-metric-label">Queries/req</span>
          <span class="perf-metric-value" style="color:${summary.avgQueryCount > HIGH_QUERY_COUNT_PER_REQ ? "var(--amber)" : "var(--text)"}">${summary.avgQueryCount}</span>
        </div>
      </div>
    `;
  }

  private renderDetailBreakdown(summary: LiveEndpointSummary) {
    const totalAvgMs = (summary.avgQueryTimeMs || 0) + (summary.avgFetchTimeMs || 0) + (summary.avgAppTimeMs || 0);
    if (totalAvgMs <= 0) return nothing;

    const dbPct = Math.round(((summary.avgQueryTimeMs || 0) / totalAvgMs) * 100);
    const fetchPct = Math.round(((summary.avgFetchTimeMs || 0) / totalAvgMs) * 100);
    const appPct = Math.max(0, 100 - dbPct - fetchPct);

    return html`
      <div class="perf-breakdown">
        <div class="perf-section-title">Time Breakdown</div>
        <div class="perf-breakdown-bar">
          ${dbPct > 0 ? html`<div class="perf-breakdown-seg perf-breakdown-db" style="width:${dbPct}%"></div>` : nothing}
          ${fetchPct > 0 ? html`<div class="perf-breakdown-seg perf-breakdown-fetch" style="width:${fetchPct}%"></div>` : nothing}
          ${appPct > 0 ? html`<div class="perf-breakdown-seg perf-breakdown-app" style="width:${appPct}%"></div>` : nothing}
        </div>
        <div class="perf-breakdown-legend">
          <span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-db"></span>DB ${formatDuration(summary.avgQueryTimeMs || 0)} (${dbPct}%)</span>
          <span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-fetch"></span>Fetch ${formatDuration(summary.avgFetchTimeMs || 0)} (${fetchPct}%)</span>
          <span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-app"></span>App ${formatDuration(summary.avgAppTimeMs || 0)} (${appPct}%)</span>
        </div>
      </div>
    `;
  }

  private renderCallers(endpointKey: string) {
    const callers = this.getCallers(endpointKey);
    if (callers.length === 0) return nothing;

    return html`
      <div class="perf-callers">
        <div class="perf-section-title">Called By</div>
        <div class="perf-callers-list">
          ${callers.map((caller) => html`
            <div class="perf-caller-row">
              <span class="perf-caller-name">${caller.label}</span>
              <span class="perf-caller-count">${caller.count} call${caller.count !== 1 ? "s" : ""}</span>
              <span class="perf-caller-avg">avg ${formatDuration(caller.avgMs)}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderQueryBreakdown() {
    if (this.queryBreakdownLoading) {
      return html`<div class="perf-queries"><div class="perf-section-title">DB Queries</div><div class="perf-queries-loading">Loading...</div></div>`;
    }
    if (this.queryBreakdown.length === 0) return nothing;

    return html`
      <div class="perf-queries">
        <div class="perf-section-title">DB Queries</div>
        <div class="perf-queries-list">
          ${this.queryBreakdown.map((queryShape) => html`
            <div class="perf-query-row">
              <span class="perf-query-label">${queryShape.label}</span>
              <span class="perf-query-avg">avg ${formatDuration(queryShape.avgMs)}</span>
              <span class="perf-query-count">${queryShape.count} call${queryShape.count !== 1 ? "s" : ""}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderTrends(endpointData: LiveEndpointData) {
    const sessions = endpointData.sessions;
    if (!sessions || sessions.length === 0) return nothing;

    const recentSessions = sessions.slice(-RECENT_SESSIONS_LIMIT);

    return html`
      <div class="perf-trends">
        <div class="perf-section-title">Session Trend</div>
        <div class="perf-trends-list">
          ${recentSessions.map((session, index) => {
            const previousP95 = index > 0 ? recentSessions[index - 1].p95DurationMs : null;
            const trend = previousP95 !== null
              ? session.p95DurationMs > previousP95 * 1.2 ? "slower" : session.p95DurationMs < previousP95 * 0.8 ? "faster" : ""
              : "";
            const timeAgo = this.formatTimeAgo(session.startedAt);
            const isCurrentSession = index === recentSessions.length - 1;
            const sessionGrade = this.healthGradeForDuration(session.p95DurationMs, endpointData.baselineP95Ms);

            return html`
              <div class="perf-trend-row ${isCurrentSession ? "perf-trend-current" : ""}">
                <span class="perf-trend-time">${isCurrentSession ? "Current" : timeAgo}</span>
                <span class="perf-trend-p95">
                  <span class="perf-hm-p95" style="color:${sessionGrade.color};background:${sessionGrade.bg};border-color:${sessionGrade.border}">
                    p95: ${formatDuration(session.p95DurationMs)}
                  </span>
                </span>
                <span class="perf-trend-reqs">${session.requestCount} req${session.requestCount !== 1 ? "s" : ""}</span>
                <span class="perf-trend-errs" style="color:${session.errorCount > 0 ? "var(--red)" : "var(--text-dim)"}">${session.errorCount} err${session.errorCount !== 1 ? "s" : ""}</span>
                ${trend ? html`<span class="perf-trend-arrow ${trend === "slower" ? "perf-trend-slower" : "perf-trend-faster"}">${trend === "slower" ? "\u2191 slower" : "\u2193 faster"}</span>` : nothing}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private formatTimeAgo(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  private renderDetailChart() {
    return html`
      <div class="perf-chart-wrap">
        <div class="perf-section-title">Response Time</div>
        <canvas id="perf-detail-canvas" class="perf-canvas" style="width:100%;height:240px"></canvas>
      </div>
    `;
  }

  private renderDetailHistory(endpointData: LiveEndpointData) {
    if (endpointData.requests.length === 0) return nothing;

    const recentRequests: { point: LiveRequestPoint; originalIndex: number }[] = [];
    for (let i = endpointData.requests.length - 1; i >= 0 && recentRequests.length < HISTORY_TABLE_LIMIT; i--) {
      recentRequests.push({ point: endpointData.requests[i], originalIndex: i });
    }

    return html`
      <div class="perf-history-wrap">
        <table class="perf-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Health</th>
              <th>Duration</th>
              <th>Breakdown</th>
              <th class="perf-th-center">Status</th>
              <th class="perf-th-right">Queries</th>
            </tr>
          </thead>
          <tbody>
            ${recentRequests.map((item) => this.renderHistoryRow(item.point, item.originalIndex, endpointData.baselineP95Ms))}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderHistoryRow(request: LiveRequestPoint, originalIndex: number, baseline?: number | null) {
    const requestGrade = this.healthGradeForDuration(request.durationMs, baseline);
    const timeStr = new Date(request.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const isError = request.statusCode >= 400;
    const dbTimeMs = request.queryTimeMs || 0;
    const fetchTimeMs = request.fetchTimeMs || 0;
    const appTimeMs = Math.max(0, request.durationMs - dbTimeMs - fetchTimeMs);

    return html`
      <tr class="perf-table-row ${isError ? "perf-row-err" : ""}" data-req-idx=${originalIndex}>
        <td class="perf-td-muted">${timeStr}</td>
        <td>
          <span class="perf-badge perf-badge-sm" style="color:${requestGrade.color};background:${requestGrade.bg};border-color:${requestGrade.border}">${requestGrade.label}</span>
        </td>
        <td>${formatDuration(request.durationMs)}</td>
        <td>
          ${dbTimeMs > 0 ? html`<span class="perf-bd-tag perf-bd-tag-db">DB ${formatDuration(dbTimeMs)}</span>` : nothing}
          ${fetchTimeMs > 0 ? html`<span class="perf-bd-tag perf-bd-tag-fetch">Fetch ${formatDuration(fetchTimeMs)}</span>` : nothing}
          <span class="perf-bd-tag perf-bd-tag-app">App ${formatDuration(appTimeMs)}</span>
        </td>
        <td class="perf-td-center" style="color:${isError ? "var(--red)" : "var(--text-muted)"}">${request.statusCode}</td>
        <td class="perf-td-right perf-td-muted">${request.queryCount}</td>
      </tr>
    `;
  }
}
