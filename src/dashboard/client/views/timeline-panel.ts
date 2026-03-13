/**
 * <bk-timeline-panel> — Shared timeline component for request/flow detail views.
 * Shows fetches, queries, logs, and errors that occurred during a request.
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { formatDuration } from "../utils/format.js";
import {
  TL_TYPE_COLORS,
  TL_TYPE_LABELS,
  LOG_LEVEL_COLORS,
  QUERY_OP_COLORS,
  TIMELINE_CACHE_MAX,
  API,
} from "../constants.js";
import { Toast } from "../components/toast.js";
import type { TimelineData, TimelineEvent } from "../store/types.js";

function queryDuration(ms: number): string {
  if (ms === 0) return "<1ms";
  return formatDuration(ms);
}

@customElement("bk-timeline-panel")
export class TimelinePanel extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @property({ attribute: "request-id" }) requestId = "";
  @property({ attribute: "request-started", type: Number }) requestStarted = 0;

  @state() private data: TimelineData | null = null;
  @state() private loading = false;
  @state() private failed = false;
  @state() private expandedSqlIdx = -1;

  /** Static cache shared across all instances; uses insertion-order eviction. */
  private static cache = new Map<string, TimelineData>();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
    if (this.requestId) this.loadTimeline();
  }

  private async loadTimeline() {
    if (!this.requestId) return;

    const cached = TimelinePanel.cache.get(this.requestId);
    if (cached) {
      this.data = cached;
      return;
    }

    this.loading = true;
    try {
      const res = await fetch(`${API.activity}?requestId=${this.requestId}`);
      const data: TimelineData = await res.json();

      // Evict oldest entry when cache is full
      if (TimelinePanel.cache.size >= TIMELINE_CACHE_MAX) {
        const oldest = TimelinePanel.cache.keys().next().value;
        if (oldest !== undefined) TimelinePanel.cache.delete(oldest);
      }
      TimelinePanel.cache.set(this.requestId, data);

      this.data = data;
      this.loading = false;
    } catch {
      this.failed = true;
      this.loading = false;
    }
  }

  private toggleSql(idx: number, e: Event) {
    e.stopPropagation();
    this.expandedSqlIdx = this.expandedSqlIdx === idx ? -1 : idx;
  }

  private copySql(sql: string, e: Event) {
    e.stopPropagation();
    navigator.clipboard.writeText(sql).then(() => Toast.show("SQL copied"));
  }

  render() {
    if (this.loading) return html`<div class="tl-loading">Loading activity...</div>`;
    if (this.failed || !this.data || this.data.total === 0) return nothing;

    const data = this.data;
    const baseTs = data.timeline[0].timestamp;

    return html`
      <div class="tl-header">
        <span class="tl-title">Activity Timeline</span>
        <span class="tl-counts">
          ${data.counts.queries > 0 ? html`<span class="tl-count tl-count-query">${data.counts.queries} quer${data.counts.queries === 1 ? "y" : "ies"}</span>` : nothing}
          ${data.counts.fetches > 0 ? html`<span class="tl-count tl-count-fetch">${data.counts.fetches} fetch${data.counts.fetches === 1 ? "" : "es"}</span>` : nothing}
          ${data.counts.logs > 0 ? html`<span class="tl-count tl-count-log">${data.counts.logs} log${data.counts.logs === 1 ? "" : "s"}</span>` : nothing}
          ${data.counts.errors > 0 ? html`<span class="tl-count tl-count-error">${data.counts.errors} error${data.counts.errors === 1 ? "" : "s"}</span>` : nothing}
        </span>
      </div>
      <div class="tl-events">${data.timeline.map((evt, idx) => this.renderEvent(evt, idx, baseTs))}</div>
    `;
  }

  private renderEvent(evt: TimelineEvent, idx: number, baseTs: number) {
    const color = TL_TYPE_COLORS[evt.type] || "var(--text-dim)";
    const label = TL_TYPE_LABELS[evt.type] || evt.type;
    const relStr = "+" + formatDuration(Math.round(evt.timestamp - baseTs));
    const isQuery = evt.type === "query" && evt.data?.sql;
    const isSqlExpanded = this.expandedSqlIdx === idx;

    return html`
      <div class="tl-event ${isQuery ? "tl-clickable" : ""}"
        style="${!isQuery ? `border-left-color:${color}` : ""}"
        @click=${isQuery ? (e: Event) => this.toggleSql(idx, e) : nothing}>
        <span class="tl-event-time">${relStr}</span>
        <span class="tl-event-type" style="color:${color}">${label}</span>
        ${this.renderEventContent(evt)}
        ${isQuery ? html`
          <div class="tl-event-sql ${isSqlExpanded ? "open" : ""}">
            <button class="tl-sql-copy" @click=${(e: Event) => this.copySql(evt.data.sql, e)}>Copy</button>
            ${evt.data.sql}
          </div>` : nothing}
      </div>
    `;
  }

  private renderEventContent(evt: TimelineEvent) {
    const d = evt.data;

    if (evt.type === "fetch") {
      const isErr = d.statusCode >= 400;
      return html`
        <span class="tl-event-summary">${d.method} ${d.url}</span>
        <span class="tl-event-status" style="${isErr ? "color:var(--red)" : ""}">${d.statusCode}</span>
        <span class="tl-event-dur">${formatDuration(d.durationMs)}</span>
      `;
    }

    if (evt.type === "query") {
      const op = (d.normalizedOp || d.operation || "?").toUpperCase();
      const table = d.table || d.model || "";
      const opColor = QUERY_OP_COLORS[op] || "var(--text-dim)";
      return html`
        <span class="tl-event-summary"><span style="color:${opColor};font-weight:600">${op}</span> ${table}</span>
        <span class="tl-event-dur">${queryDuration(d.durationMs)}</span>
      `;
    }

    if (evt.type === "log") {
      const lColor = LOG_LEVEL_COLORS[d.level] || "var(--text-dim)";
      return html`<span class="tl-event-summary"><span style="color:${lColor}">${d.level.toUpperCase()}</span> ${d.message}</span>`;
    }

    if (evt.type === "error") {
      return html`<span class="tl-event-summary" style="color:var(--red)">${d.name}: ${d.message}</span>`;
    }

    return nothing;
  }
}
