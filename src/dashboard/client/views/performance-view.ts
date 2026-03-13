/** <bk-performance-view> — Performance monitoring with canvas scatter charts. */

import { LitElement, html, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import {
  ALL_ENDPOINTS_SELECTOR,
  GRAPH_COLORS,
  DOT_COLORS,
  HEALTH_GRADES,
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  HIGH_QUERY_COUNT_PER_REQ,
  CHART_PAD,
  CHART_GRID_COLOR,
  CHART_LABEL_COLOR,
  CHART_FONT,
  CHART_FONT_SM,
  CHART_FONT_XS,
  API,
} from "../constants.js";
import type { HealthGrade } from "../constants.js";
import type { LiveRequestPoint, LiveEndpointData, LiveEndpointSummary } from "../store/types.js";

interface ScatterDot {
  x: number;
  y: number;
  idx: number;
  r: LiveRequestPoint;
}

@customElement("bk-performance-view")
export class PerformanceView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private selectedEndpoint: string = ALL_ENDPOINTS_SELECTOR;
  @state() private graphData: LiveEndpointData[] = [];
  @state() private loadError = false;

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
      const res = await fetch(API.metricsLive);
      const data = await res.json();
      this.graphData = data.endpoints || [];
      this.loadError = false;
      if (!this.selectedEndpoint || this.selectedEndpoint === ALL_ENDPOINTS_SELECTOR) {
        this.selectedEndpoint = ALL_ENDPOINTS_SELECTOR;
      }
    } catch {
      this.loadError = true;
    }
  }

  private healthGrade(ms: number): HealthGrade {
    for (const grade of HEALTH_GRADES) {
      if (ms < grade.max) return grade;
    }
    return HEALTH_GRADES[HEALTH_GRADES.length - 1];
  }

  private fmtMs(ms: number): string {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return Math.round(ms) + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  private dotColor(ms: number): string {
    if (ms < HEALTH_GOOD_MS) return DOT_COLORS.green;
    if (ms < HEALTH_OK_MS) return DOT_COLORS.amber;
    return DOT_COLORS.red;
  }

  private reqDotColor(r: LiveRequestPoint): string {
    if (r.statusCode >= 400) return DOT_COLORS.red;
    return this.dotColor(r.durationMs);
  }

  /** Parses a hex color string (#rrggbb) into [r, g, b] components. */
  private parseHex(color: string): [number, number, number] {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  }

  private setupCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  private drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
    const [r, g, b] = this.parseHex(color);
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawErrorX(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, lineWidth: number) {
    const [r, g, b] = this.parseHex(color);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
    ctx.lineWidth = lineWidth + 2;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
    ctx.stroke();
  }

  private drawScatterChart(canvas: HTMLCanvasElement, requests: LiveRequestPoint[]) {
    this.scatterDots = [];
    const setup = this.setupCanvas(canvas);
    if (!setup || requests.length === 0) return;
    const { ctx, w, h } = setup;

    const pad = CHART_PAD;
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    let maxVal = 0, minTime = requests[0].timestamp, maxTime = requests[0].timestamp;
    for (const r of requests) {
      if (r.durationMs > maxVal) maxVal = r.durationMs;
      if (r.timestamp < minTime) minTime = r.timestamp;
      if (r.timestamp > maxTime) maxTime = r.timestamp;
    }
    maxVal = Math.max(maxVal, 10);
    maxVal = Math.ceil((maxVal * 1.15) / 10) * 10;
    const timeRange = maxTime - minTime || 1;

    // Grid lines
    ctx.strokeStyle = CHART_GRID_COLOR;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let gi = 0; gi <= gridLines; gi++) {
      const gy = pad.top + ch - (gi / gridLines) * ch;
      ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(pad.left + cw, gy); ctx.stroke();
      ctx.fillStyle = CHART_LABEL_COLOR;
      ctx.font = CHART_FONT;
      ctx.textAlign = "right";
      ctx.fillText(this.fmtMs(Math.round((gi / gridLines) * maxVal)), pad.left - 8, gy + 3);
    }

    // Threshold dashed lines
    for (const t of [{ ms: HEALTH_GOOD_MS }, { ms: HEALTH_OK_MS }]) {
      if (t.ms >= maxVal) continue;
      const ty = pad.top + ch - (t.ms / maxVal) * ch;
      ctx.beginPath(); ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(113,113,122,0.3)"; ctx.lineWidth = 1;
      ctx.moveTo(pad.left, ty); ctx.lineTo(pad.left + cw, ty); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(113,113,122,0.5)"; ctx.font = CHART_FONT_SM;
      ctx.textAlign = "left";
      ctx.fillText(this.fmtMs(t.ms), pad.left + cw + 2, ty + 3);
    }

    // Data points
    for (let idx = 0; idx < requests.length; idx++) {
      const r = requests[idx];
      const x = requests.length === 1 ? pad.left + cw / 2 : pad.left + ((r.timestamp - minTime) / timeRange) * cw;
      const y = pad.top + ch - (r.durationMs / maxVal) * ch;
      const color = this.reqDotColor(r);
      this.scatterDots.push({ x, y, idx, r });
      if (r.statusCode >= 400) this.drawErrorX(ctx, x, y, 4, color, 2);
      else this.drawDot(ctx, x, y, 4, color);
    }

    // Time axis
    ctx.fillStyle = CHART_LABEL_COLOR; ctx.font = CHART_FONT_SM; ctx.textAlign = "center";
    const timePoints = [minTime, minTime + timeRange / 2, maxTime];
    for (let i = 0; i < timePoints.length; i++) {
      const x = pad.left + (i / 2) * cw;
      const d = new Date(timePoints[i]);
      ctx.fillText(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }), x, pad.top + ch + 14);
    }

    canvas.style.cursor = "pointer";
    canvas.onclick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let closest: ScatterDot | null = null, closestDist = Infinity;
      for (const d of this.scatterDots) {
        const dist = Math.sqrt((d.x - mx) ** 2 + (d.y - my) ** 2);
        if (dist < closestDist) { closestDist = dist; closest = d; }
      }
      if (closest && closestDist < 16) this.highlightRow(closest.idx);
    };
  }

  private drawInlineScatter(canvas: HTMLCanvasElement, requests: LiveRequestPoint[]) {
    const setup = this.setupCanvas(canvas);
    if (!setup || requests.length === 0) return;
    const { ctx, w, h } = setup;

    const padX = 4, padY = 4;
    const cw = w - padX * 2, ch = h - padY * 2;

    let maxVal = 0, minTime = requests[0].timestamp, maxTime = requests[0].timestamp;
    for (const r of requests) {
      if (r.durationMs > maxVal) maxVal = r.durationMs;
      if (r.timestamp < minTime) minTime = r.timestamp;
      if (r.timestamp > maxTime) maxTime = r.timestamp;
    }
    maxVal = Math.max(maxVal, 10);
    maxVal = Math.ceil((maxVal * 1.15) / 10) * 10;
    const timeRange = maxTime - minTime || 1;

    for (const ms of [HEALTH_GOOD_MS, HEALTH_OK_MS]) {
      if (ms >= maxVal) continue;
      const ty = padY + ch - (ms / maxVal) * ch;
      ctx.beginPath(); ctx.setLineDash([2, 3]);
      ctx.strokeStyle = "rgba(113,113,122,0.15)"; ctx.lineWidth = 1;
      ctx.moveTo(padX, ty); ctx.lineTo(padX + cw, ty); ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const r of requests) {
      const x = requests.length === 1 ? padX + cw / 2 : padX + ((r.timestamp - minTime) / timeRange) * cw;
      const y = padY + ch - (r.durationMs / maxVal) * ch;
      const color = this.reqDotColor(r);
      if (r.statusCode >= 400) this.drawErrorX(ctx, x, y, 2.5, color, 1.5);
      else this.drawDot(ctx, x, y, 2.5, color);
    }

    ctx.fillStyle = "rgba(113,113,122,0.5)"; ctx.font = CHART_FONT_XS;
    ctx.textAlign = "right";
    ctx.fillText(this.fmtMs(maxVal), w - 2, padY + 8);
    ctx.fillText(this.fmtMs(0), w - 2, h - 2);
  }

  private highlightRow(reqIdx: number) {
    const prev = this.querySelector(".perf-hist-row-hl");
    if (prev) prev.classList.remove("perf-hist-row-hl");
    const row = this.querySelector(`[data-req-idx="${reqIdx}"]`);
    if (row) {
      row.classList.add("perf-hist-row-hl");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  updated() {
    if (this.selectedEndpoint === ALL_ENDPOINTS_SELECTOR) {
      this.graphData.forEach((ep, idx) => {
        if (ep.requests.length === 0) return;
        const canvas = this.querySelector<HTMLCanvasElement>(`#inline-scatter-${idx}`);
        if (canvas) this.drawInlineScatter(canvas, ep.requests);
      });
    } else {
      const canvas = this.querySelector<HTMLCanvasElement>("#perf-detail-canvas");
      if (canvas) {
        const ep = this.graphData.find((e) => e.endpoint === this.selectedEndpoint);
        if (ep) this.drawScatterChart(canvas, ep.requests);
      }
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
        ${this.graphData.map((ep, idx) => html`
          <button class="perf-selector-btn ${ep.endpoint === this.selectedEndpoint ? "active" : ""}"
            @click=${() => { this.selectedEndpoint = ep.endpoint; }}>
            <span class="perf-dot" style="background:${GRAPH_COLORS[idx % GRAPH_COLORS.length]}"></span>${ep.endpoint}
          </button>
        `)}
      </div>
    `;
  }

  private renderOverview() {
    return html`
      <div class="perf-endpoint-list">
        ${this.graphData.map((ep, idx) => ep.requests.length === 0 ? nothing : this.renderEndpointCard(ep, idx))}
      </div>
    `;
  }

  private renderEndpointCard(ep: LiveEndpointData, idx: number) {
    const s = ep.summary;
    const g = this.healthGrade(s.p95Ms);
    const errors = Math.round(s.errorRate * s.totalRequests);

    const ovTotal = (s.avgQueryTimeMs || 0) + (s.avgFetchTimeMs || 0) + (s.avgAppTimeMs || 0);
    let breakdownHtml: TemplateResult | typeof nothing = nothing;
    if (ovTotal > 0) {
      const dbPct = Math.round(((s.avgQueryTimeMs || 0) / ovTotal) * 100);
      const fetchPct = Math.round(((s.avgFetchTimeMs || 0) / ovTotal) * 100);
      const appPct = Math.max(0, 100 - dbPct - fetchPct);
      breakdownHtml = html`
        <div class="perf-breakdown-inline">
          <div class="perf-breakdown-bar perf-breakdown-bar-sm">
            ${dbPct > 0 ? html`<div class="perf-breakdown-seg perf-breakdown-db" style="width:${dbPct}%"></div>` : nothing}
            ${fetchPct > 0 ? html`<div class="perf-breakdown-seg perf-breakdown-fetch" style="width:${fetchPct}%"></div>` : nothing}
            ${appPct > 0 ? html`<div class="perf-breakdown-seg perf-breakdown-app" style="width:${appPct}%"></div>` : nothing}
          </div>
          <span class="perf-breakdown-labels">
            ${dbPct > 0 ? html`<span class="perf-breakdown-lbl"><span class="perf-breakdown-dot perf-breakdown-db"></span>${this.fmtMs(s.avgQueryTimeMs || 0)}</span>` : nothing}
            ${fetchPct > 0 ? html`<span class="perf-breakdown-lbl"><span class="perf-breakdown-dot perf-breakdown-fetch"></span>${this.fmtMs(s.avgFetchTimeMs || 0)}</span>` : nothing}
            <span class="perf-breakdown-lbl"><span class="perf-breakdown-dot perf-breakdown-app"></span>${this.fmtMs(s.avgAppTimeMs || 0)}</span>
          </span>
        </div>
      `;
    }

    return html`
      <div class="perf-endpoint-card" @click=${() => { this.selectedEndpoint = ep.endpoint; }}>
        <div class="perf-ep-header">
          <span class="perf-ep-name">${ep.endpoint}</span>
          <span class="perf-ep-stats">
            <span class="perf-ep-stat" style="color:${g.color}">p95: ${this.fmtMs(s.p95Ms)}</span>
            <span class="perf-ep-stat ${errors > 0 ? "perf-ep-stat-err" : ""}">${errors} err</span>
            ${s.avgQueryCount > 0 ? html`<span class="perf-ep-stat ${s.avgQueryCount > HIGH_QUERY_COUNT_PER_REQ ? "perf-ep-stat-warn" : ""}">${s.avgQueryCount} q/req</span>` : nothing}
            <span class="perf-ep-stat perf-ep-stat-muted">${s.totalRequests} req${s.totalRequests !== 1 ? "s" : ""}</span>
          </span>
        </div>
        ${breakdownHtml}
        <canvas id="inline-scatter-${idx}" class="perf-inline-canvas"></canvas>
      </div>
    `;
  }

  private renderDetail() {
    const ep = this.graphData.find((e) => e.endpoint === this.selectedEndpoint);
    if (!ep?.requests?.length) {
      return html`<bk-empty-state subtitle="No data for this endpoint"></bk-empty-state>`;
    }

    const s = ep.summary;
    const g = this.healthGrade(s.p95Ms);
    const errors = Math.round(s.errorRate * s.totalRequests);

    return html`
      ${this.renderDetailHeader(ep, g)}
      ${this.renderDetailMetrics(s, g, errors)}
      ${this.renderDetailBreakdown(s)}
      ${this.renderDetailChart()}
      ${this.renderDetailHistory(ep)}
    `;
  }

  private renderDetailHeader(ep: LiveEndpointData, g: HealthGrade) {
    return html`
      <div class="perf-detail-header">
        <div class="perf-detail-title">
          <span class="perf-badge perf-badge-lg" style="color:${g.color};background:${g.bg};border-color:${g.border}">${g.label}</span>
          <span>${ep.endpoint}</span>
        </div>
      </div>
    `;
  }

  private renderDetailMetrics(s: LiveEndpointSummary, g: HealthGrade, errors: number) {
    return html`
      <div class="perf-metric-row">
        <div class="perf-metric-card">
          <span class="perf-metric-label">P95</span>
          <span class="perf-metric-value" style="color:${g.color}">${this.fmtMs(s.p95Ms)}</span>
        </div>
        <div class="perf-metric-card">
          <span class="perf-metric-label">Errors</span>
          <span class="perf-metric-value" style="color:${errors > 0 ? "var(--red)" : "var(--green)"}">
            ${errors > 0 ? errors + " (" + Math.round(s.errorRate * 100) + "%)" : "0"}
          </span>
        </div>
        <div class="perf-metric-card">
          <span class="perf-metric-label">Queries/req</span>
          <span class="perf-metric-value" style="color:${s.avgQueryCount > HIGH_QUERY_COUNT_PER_REQ ? "var(--amber)" : "var(--text)"}">${s.avgQueryCount}</span>
        </div>
      </div>
    `;
  }

  private renderDetailBreakdown(s: LiveEndpointSummary) {
    const totalAvg = (s.avgQueryTimeMs || 0) + (s.avgFetchTimeMs || 0) + (s.avgAppTimeMs || 0);
    if (totalAvg <= 0) return nothing;

    const dbPct = Math.round(((s.avgQueryTimeMs || 0) / totalAvg) * 100);
    const fetchPct = Math.round(((s.avgFetchTimeMs || 0) / totalAvg) * 100);
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
          <span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-db"></span>DB ${this.fmtMs(s.avgQueryTimeMs || 0)} (${dbPct}%)</span>
          <span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-fetch"></span>Fetch ${this.fmtMs(s.avgFetchTimeMs || 0)} (${fetchPct}%)</span>
          <span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-app"></span>App ${this.fmtMs(s.avgAppTimeMs || 0)} (${appPct}%)</span>
        </div>
      </div>
    `;
  }

  private renderDetailChart() {
    return html`
      <div class="perf-chart-wrap">
        <div class="perf-section-title">Response Time</div>
        <canvas id="perf-detail-canvas" class="perf-canvas" style="width:100%;height:240px"></canvas>
      </div>
    `;
  }

  private renderDetailHistory(ep: LiveEndpointData) {
    if (ep.requests.length === 0) return nothing;

    const recent: { r: LiveRequestPoint; origIdx: number }[] = [];
    for (let i = ep.requests.length - 1; i >= 0 && recent.length < 50; i--) {
      recent.push({ r: ep.requests[i], origIdx: i });
    }

    return html`
      <div class="perf-history-wrap">
        <div class="col-header">
          <span class="perf-col perf-col-date">Time</span>
          <span class="perf-col perf-col-health">Health</span>
          <span class="perf-col perf-col-avg">Duration</span>
          <span class="perf-col perf-col-breakdown">Breakdown</span>
          <span class="perf-col perf-col-status">Status</span>
          <span class="perf-col perf-col-qpr">Queries</span>
        </div>
        ${recent.map((item) => this.renderHistoryRow(item.r, item.origIdx))}
      </div>
    `;
  }

  private renderHistoryRow(r: LiveRequestPoint, origIdx: number) {
    const rg = this.healthGrade(r.durationMs);
    const timeStr = new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const isError = r.statusCode >= 400;
    const rDbMs = r.queryTimeMs || 0;
    const rFetchMs = r.fetchTimeMs || 0;
    const rAppMs = Math.max(0, r.durationMs - rDbMs - rFetchMs);

    return html`
      <div class="perf-hist-row ${isError ? "perf-hist-row-err" : ""}" data-req-idx=${origIdx}>
        <span class="perf-col perf-col-date">${timeStr}</span>
        <span class="perf-col perf-col-health">
          <span class="perf-badge perf-badge-sm" style="color:${rg.color};background:${rg.bg};border-color:${rg.border}">${rg.label}</span>
        </span>
        <span class="perf-col perf-col-avg">${this.fmtMs(r.durationMs)}</span>
        <span class="perf-col perf-col-breakdown">
          ${rDbMs > 0 ? html`<span class="perf-bd-tag perf-bd-tag-db">DB ${this.fmtMs(rDbMs)}</span>` : nothing}
          ${rFetchMs > 0 ? html`<span class="perf-bd-tag perf-bd-tag-fetch">Fetch ${this.fmtMs(rFetchMs)}</span>` : nothing}
          <span class="perf-bd-tag perf-bd-tag-app">App ${this.fmtMs(rAppMs)}</span>
        </span>
        <span class="perf-col perf-col-status" style="color:${isError ? "var(--red)" : "var(--text-muted)"}">${r.statusCode}</span>
        <span class="perf-col perf-col-qpr">${r.queryCount}</span>
      </div>
    `;
  }
}
