/** <bk-flows-view> — User action flows with insights and waterfall timeline tabs. */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import {
  formatDuration,
  formatSize,
  escHtml,
  statusPillClass,
  formatHeaders,
  formatJsonBody,
} from "../utils/format.js";
import { copyAsCurl } from "../utils/curl.js";
import { subEventColor } from "../utils/request-colors.js";
import { buildWaterfallRows } from "../utils/waterfall.js";
import type { WaterfallRow } from "../utils/waterfall.js";
import {
  AUTH_SKIP_CATEGORIES,
  CATEGORY_STATIC,
  CATEGORY_POLLING,
  API,
  WF_TICK_COUNT,
} from "../constants.js";
import type {
  FlowData,
  FlowRequest,
  FlowActivityData,
} from "../store/types.js";
import { analyzeFlow } from "../utils/flow-analysis.js";

type FlowDetailTab = "insights" | "timeline";

@customElement("bk-flows-view")
export class FlowsView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private expandedFlowIdx = -1;
  @state() private expandedSubReqIdx = -1;
  @state() private flowDetailTab: FlowDetailTab = "insights";
  @state() private flowTimeline: FlowActivityData | null = null;
  @state() private flowTimelineLoading = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  private get flows(): FlowData[] {
    return this.store.state.flows;
  }

  private get viewMode() {
    return this.store.state.viewMode;
  }

  private flowDotClass(flow: FlowData): string {
    if (flow.hasErrors) return "dot-error";
    if (flow.redundancyPct > 0) return "dot-warn";
    return "dot-clean";
  }

  private flowBadgeInfo(flow: FlowData): { text: string; cls: string } {
    if (flow.hasErrors) {
      const errCount = flow.requests.filter((r) => r.statusCode >= 400).length;
      return {
        text: errCount + " error" + (errCount !== 1 ? "s" : ""),
        cls: "badge-error",
      };
    }
    if (flow.redundancyPct > 0) {
      return { text: flow.redundancyPct + "% redundant", cls: "badge-warn" };
    }
    return { text: "clean", cls: "badge-clean" };
  }

  private toggleFlow(idx: number) {
    if (this.expandedFlowIdx === idx) {
      this.expandedFlowIdx = -1;
    } else {
      this.expandedFlowIdx = idx;
      this.expandedSubReqIdx = -1;
      this.flowDetailTab = "insights";
      this.flowTimeline = null;
    }
  }

  private toggleSubReq(idx: number, e: Event) {
    e.stopPropagation();
    this.expandedSubReqIdx = this.expandedSubReqIdx === idx ? -1 : idx;
  }

  private toggleBodyBlock(e: Event) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const block = btn.parentElement;
    if (!block) return;
    btn.classList.toggle("open");
    const pre = block.querySelector("pre");
    if (pre) pre.classList.toggle("open");
  }

  private switchTab(tab: FlowDetailTab, flow: FlowData, e: Event) {
    e.stopPropagation();
    this.flowDetailTab = tab;
    if (tab === "timeline" && !this.flowTimeline) {
      this.loadFlowTimeline(flow);
    }
  }

  private async loadFlowTimeline(flow: FlowData) {
    if (this.flowTimelineLoading) return;

    const ids = flow.requests.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return;

    this.flowTimelineLoading = true;
    try {
      const res = await fetch(`${API.activity}?requestIds=${ids.join(",")}`);
      if (!res.ok) {
        this.flowTimelineLoading = false;
        return;
      }
      this.flowTimeline = await res.json();
    } catch {
      // Retry available by switching tabs
    }
    this.flowTimelineLoading = false;
  }

  private loadTimelineForContainer(container: HTMLElement) {
    const tlEls = container.querySelectorAll<HTMLElement>(".request-timeline");
    for (const tlEl of tlEls) {
      const rid = tlEl.getAttribute("data-request-id");
      if (rid && !tlEl.hasAttribute("data-loaded")) {
        tlEl.setAttribute("data-loaded", "1");
        const panel = document.createElement("bk-timeline-panel") as any;
        panel.setAttribute("request-id", rid);
        panel.setAttribute(
          "request-started",
          tlEl.getAttribute("data-request-started") || "0",
        );
        tlEl.appendChild(panel);
        tlEl.classList.remove("tl-hidden");
      }
    }
  }

  updated() {
    if (this.expandedFlowIdx >= 0 && this.flowDetailTab === "insights") {
      const expandEl = this.querySelector(".flow-expand.open") as HTMLElement;
      if (expandEl) this.loadTimelineForContainer(expandEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  render() {
    const flows = this.flows;
    if (flows.length === 0) {
      return html`<bk-empty-state
        title="No actions yet"
        subtitle="Start using your app to see user action flows here"
      ></bk-empty-state>`;
    }

    return html`
      <div id="flow-col-header" class="col-header">
        <span style="width:8px"></span>
        <span style="flex:1">Action</span>
        <span style="width:60px;text-align:right">Reqs</span>
        <span style="width:120px;text-align:right">Status</span>
        <span style="width:70px;text-align:right">Time</span>
      </div>
      <div id="flow-list">
        ${flows.map((flow, idx) => this.renderFlowRow(flow, idx))}
      </div>
    `;
  }

  private renderFlowRow(flow: FlowData, idx: number) {
    const isExpanded = this.expandedFlowIdx === idx;
    const dotClass = this.flowDotClass(flow);
    const badge = this.flowBadgeInfo(flow);

    return html`
      <div
        class="flow-row ${isExpanded ? "expanded" : ""}"
        @click=${() => this.toggleFlow(idx)}
      >
        <div class="flow-summary-row">
          <span class="flow-status-dot ${dotClass}"></span>
          <span class="flow-label">${flow.label}</span>
          <span class="flow-req-count"
            >${flow.requests.length}
            req${flow.requests.length !== 1 ? "s" : ""}</span
          >
          <span class="flow-badge-pill ${badge.cls}">${badge.text}</span>
          <span class="flow-duration"
            >${formatDuration(flow.totalDurationMs)}</span
          >
        </div>
      </div>
      <div class="flow-expand ${isExpanded ? "open" : ""}">
        ${isExpanded ? this.renderFlowDetail(flow) : nothing}
      </div>
    `;
  }

  private renderFlowDetail(flow: FlowData) {
    const insightsLabel = this.viewMode === "simple" ? "Insights" : "Details";

    return html`
      <div class="flow-detail-tabs">
        <button
          class="flow-tab ${this.flowDetailTab === "insights" ? "active" : ""}"
          @click=${(e: Event) => this.switchTab("insights", flow, e)}
        >
          ${insightsLabel}
        </button>
        <button
          class="flow-tab ${this.flowDetailTab === "timeline" ? "active" : ""}"
          @click=${(e: Event) => this.switchTab("timeline", flow, e)}
        >
          Timeline
        </button>
      </div>
      ${this.flowDetailTab === "insights"
        ? this.viewMode === "simple"
          ? this.renderFlowInsights(flow)
          : this.renderFlowSubReqs(flow)
        : this.renderFlowWaterfall(flow)}
    `;
  }

  private renderFlowWaterfall(flow: FlowData) {
    if (this.flowTimelineLoading) {
      return html`<div class="wf-loading">Loading timeline...</div>`;
    }

    const { rows, totalMs } = buildWaterfallRows(flow, this.flowTimeline);
    if (rows.length === 0) return nothing;

    const ticks: string[] = [];
    for (let i = 0; i <= WF_TICK_COUNT; i++) {
      ticks.push(formatDuration((totalMs / WF_TICK_COUNT) * i));
    }

    return html`
      <div class="flow-waterfall">
        <div class="wf-time-axis">
          ${ticks.map((t) => html`<span>${t}</span>`)}
        </div>
        <div class="wf-rows">
          ${rows.map((row) => this.renderWaterfallGroup(row))}
        </div>
      </div>
    `;
  }

  private renderWaterfallGroup(row: WaterfallRow) {
    return html`
      <div class="wf-request-group">
        <div class="wf-req-row" title="${row.tooltip}">
          <div class="wf-req-label">${row.label}</div>
          <div class="wf-bar-track">
            <div
              class="wf-bar"
              style="left:${row.leftPct}%;width:${row.widthPct}%;background:${row.color}"
            ></div>
          </div>
          <div class="wf-req-dur">${row.durLabel}</div>
        </div>
        ${row.subEvents.length > 0
          ? row.subEvents.map(
              (sub) => html`
                <div class="wf-sub-row" title="${sub.tooltip}">
                  <div class="wf-sub-label">
                    <span
                      class="wf-sub-dot"
                      style="background:${subEventColor(sub.type)}"
                    ></span>
                    ${sub.label}
                  </div>
                  <div class="wf-bar-track">
                    <div
                      class="wf-bar wf-sub-bar-sized"
                      style="left:${row.leftPct +
                      (sub.leftPct / 100) *
                        row.widthPct}%;width:${(sub.widthPct / 100) *
                      row.widthPct}%;background:${subEventColor(sub.type)}"
                    ></div>
                  </div>
                  <div class="wf-sub-dur">${sub.durLabel}</div>
                </div>
              `,
            )
          : nothing}
      </div>
    `;
  }

  private renderFlowInsights(flow: FlowData) {
    const insights = analyzeFlow(flow);
    const hasIssues =
      insights.errors.length > 0 ||
      insights.duplicates.length > 0 ||
      insights.warnings.length > 0 ||
      !!insights.tip;

    return html`
      <div>
        <div class="flow-traffic">
          ${flow.requests.map((req) => this.renderTrafficCard(req))}
        </div>
        ${hasIssues
          ? html`
              <div class="flow-divider"></div>
              <div class="flow-insights">
                ${insights.errors.map(
                  (err) =>
                    html`<div class="insight-line insight-error">
                      ✗ ${err}
                    </div>`,
                )}
                ${insights.duplicates.map(
                  (dup) =>
                    html`<div class="insight-line insight-warn">
                      ⚠ ${dup.name} — loaded ${dup.count}x (wasting
                      ~${formatDuration(dup.wastedMs)})
                    </div>`,
                )}
                ${insights.warnings.map(
                  (w) =>
                    html`<div class="insight-line insight-warn">⚠ ${w}</div>`,
                )}
                ${insights.tip
                  ? html`<div class="insight-line insight-tip">
                      Tip: ${insights.tip}
                    </div>`
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderTrafficCard(req: FlowRequest) {
    if (AUTH_SKIP_CATEGORIES[req.category || ""]) return nothing;

    const sClass = statusPillClass(req.statusCode);
    const dur = formatDuration(req.pollingDurationMs || req.durationMs);
    const hasDetails =
      (!req.isDuplicate &&
        req.category !== CATEGORY_STATIC &&
        req.category !== CATEGORY_POLLING) ||
      (req.requestBody && req.method !== "GET") ||
      !!req.responseBody;

    return html`
      <div
        class="traffic-card ${req.isStrictModeDupe ? "strict-mode-dupe" : ""}"
      >
        <div class="traffic-card-header ${hasDetails ? "has-details" : ""}">
          <bk-method-badge .method=${req.method}></bk-method-badge>
          <span class="traffic-card-path ${req.isDuplicate ? "is-dup" : ""}"
            >${req.label}</span
          >
          <span class="status-pill ${sClass}">${req.statusCode}</span>
          <span class="traffic-card-dur">${dur}</span>
          ${req.isDuplicate
            ? html`<span class="traffic-card-dup">duplicate</span>`
            : html`<span class="traffic-card-size"
                >${formatSize(req.responseSize)}</span
              >`}
        </div>
        ${req.isStrictModeDupe
          ? html`<div class="strict-mode-banner">
              React Strict Mode duplicate — does not happen in production
            </div>`
          : nothing}
        ${!req.isDuplicate &&
        req.category !== CATEGORY_STATIC &&
        req.category !== CATEGORY_POLLING
          ? html`<div
              class="request-timeline tl-hidden"
              data-request-id=${req.id}
              data-request-started=${String(req.startedAt)}
            ></div>`
          : nothing}
        ${req.requestBody && req.method !== "GET"
          ? this.renderBodyToggle("out", "Request Body", req.requestBody)
          : nothing}
        ${req.responseBody
          ? this.renderBodyToggle("in", "Response Body", req.responseBody)
          : nothing}
      </div>
    `;
  }

  private renderBodyToggle(direction: string, label: string, body: string) {
    const arrowChar = direction === "out" ? "\u2192" : "\u2190";
    return html`
      <div class="traffic-body">
        <button class="traffic-body-toggle" @click=${this.toggleBodyBlock}>
          <span class="chevron">▸</span
          ><span class="arrow-${direction}">${arrowChar}</span> ${label}
        </button>
        <pre .innerHTML=${formatJsonBody(body)}></pre>
      </div>
    `;
  }

  private renderFlowSubReqs(flow: FlowData) {
    return html`<div class="flow-subreqs">
      ${flow.requests.map((req, idx) => this.renderSubReqRow(req, idx))}
    </div>`;
  }

  private renderSubReqRow(req: FlowRequest, idx: number) {
    const isExpanded = this.expandedSubReqIdx === idx;
    const sClass = statusPillClass(req.statusCode);
    const dur = req.pollingDurationMs
      ? formatDuration(req.pollingDurationMs)
      : formatDuration(req.durationMs);

    return html`
      <div
        class="flow-subreq ${isExpanded ? "expanded" : ""}"
        @click=${(e: Event) => this.toggleSubReq(idx, e)}
      >
        <bk-method-badge .method=${req.method}></bk-method-badge>
        <span class="subreq-label ${req.isDuplicate ? "is-dup" : ""}"
          >${req.path || req.url}</span
        >
        ${req.isDuplicate
          ? html`<span class="subreq-dup-tag">duplicate</span>`
          : nothing}
        <span class="status-pill ${sClass}">${req.statusCode}</span>
        <span class="subreq-dur">${dur}</span>
      </div>
      <div class="flow-subreq-detail ${isExpanded ? "open" : ""}">
        ${isExpanded ? this.renderSubReqDetail(req) : nothing}
      </div>
    `;
  }

  private renderSubReqDetail(req: FlowRequest) {
    const sClass = statusPillClass(req.statusCode);
    return html`
      <div class="detail-meta">
        <span
          ><bk-method-badge .method=${req.method}></bk-method-badge> ${escHtml(
            req.url,
          )}</span
        >
        <span
          ><span class="status-pill ${sClass}">${req.statusCode}</span></span
        >
        <span>${req.durationMs}ms</span>
        ${req.responseSize
          ? html`<span>${formatSize(req.responseSize)}</span>`
          : nothing}
      </div>
      <div
        class="request-timeline tl-hidden"
        data-request-id=${req.id}
        data-request-started=${String(req.startedAt)}
      ></div>
      <div class="detail-grid">
        <div class="detail-section">
          <h4>Request Headers</h4>
          <pre .innerHTML=${formatHeaders(req.headers)}></pre>
        </div>
        <div class="detail-section">
          <h4>Response Headers</h4>
          <pre .innerHTML=${formatHeaders(req.responseHeaders)}></pre>
        </div>
        <div class="detail-section">
          <h4>Request Body</h4>
          <pre .innerHTML=${formatJsonBody(req.requestBody)}></pre>
        </div>
        <div class="detail-section">
          <h4>Response Body</h4>
          <pre .innerHTML=${formatJsonBody(req.responseBody)}></pre>
        </div>
      </div>
      <div class="detail-actions">
        <button
          class="btn btn-curl"
          @click=${(e: Event) => {
            e.stopPropagation();
            copyAsCurl(req);
          }}
        >
          Copy cURL
        </button>
      </div>
    `;
  }
}
