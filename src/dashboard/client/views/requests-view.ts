/** <bk-requests-view> — HTTP request list with expandable detail panels. */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { DASHBOARD_PREFIX } from "../constants.js";
import { formatSize, formatHeaders, formatJsonBody } from "../utils/format.js";
import { copyAsCurl } from "../utils/curl.js";
import type { TracedRequest } from "../store/types.js";

@customElement("bk-requests-view")
export class RequestsView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private expandedId: string | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  private toggleRequest(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  private handleCopyAsCurl(req: TracedRequest, e: Event) {
    e.stopPropagation();
    copyAsCurl(req);
  }

  private renderDetail(req: TracedRequest) {
    return html`
      <div class="detail-meta">
        <span><bk-method-badge .method=${req.method}></bk-method-badge> ${req.url}</span>
        <span><bk-status-pill .code=${req.statusCode}></bk-status-pill></span>
        <span>${req.durationMs}ms</span>
        ${req.responseSize ? html`<span>${formatSize(req.responseSize)}</span>` : nothing}
      </div>
      <div class="request-timeline tl-hidden" data-request-id=${req.id} data-request-started=${String(req.startedAt)}></div>
      <div class="detail-grid">
        <div class="detail-section"><h4>Request Headers</h4><pre .innerHTML=${formatHeaders(req.headers)}></pre></div>
        <div class="detail-section"><h4>Response Headers</h4><pre .innerHTML=${formatHeaders(req.responseHeaders)}></pre></div>
        <div class="detail-section"><h4>Request Body</h4><pre .innerHTML=${formatJsonBody(req.requestBody)}></pre></div>
        <div class="detail-section"><h4>Response Body</h4><pre .innerHTML=${formatJsonBody(req.responseBody)}></pre></div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-curl" @click=${(e: Event) => this.handleCopyAsCurl(req, e)}>Copy cURL</button>
      </div>
    `;
  }

  private renderRequestRow(req: TracedRequest) {
    const expanded = this.expandedId === req.id;
    return html`
      <div class="req-row ${expanded ? "expanded" : ""}" @click=${() => this.toggleRequest(req.id)}>
        <div class="req-summary">
          <bk-method-badge .method=${req.method}></bk-method-badge>
          <span class="req-url">${req.url}</span>
          <bk-status-pill .code=${req.statusCode}></bk-status-pill>
          <bk-duration-label .ms=${req.durationMs}></bk-duration-label>
          <span class="req-size">${formatSize(req.responseSize)}</span>
        </div>
      </div>
      <div class="req-detail ${expanded ? "open" : ""}">${expanded ? this.renderDetail(req) : nothing}</div>
    `;
  }

  render() {
    const requests = this.store.state.requests.filter((r) => !r.path?.startsWith(DASHBOARD_PREFIX));

    if (requests.length === 0) {
      return html`<bk-empty-state title="No requests" subtitle="No HTTP requests have been captured yet"></bk-empty-state>`;
    }

    return html`
      <div class="col-header">
        <span style="width:60px">Method</span>
        <span style="flex:1">URL</span>
        <span style="width:36px;text-align:right">Status</span>
        <span style="width:70px;text-align:right">Time</span>
        <span style="width:60px;text-align:right">Size</span>
      </div>
      <div id="request-list">${requests.map((req) => this.renderRequestRow(req))}</div>
    `;
  }
}
