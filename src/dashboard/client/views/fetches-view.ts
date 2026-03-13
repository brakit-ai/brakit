/** <bk-fetches-view> — Outbound HTTP calls grouped by URL. */

import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { formatDuration } from "../utils/format.js";
import type { TracedFetch, TracedRequest, FetchGroup } from "../store/types.js";

@customElement("bk-fetches-view")
export class FetchesView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  /** Pre-builds a request ID map for O(1) caller resolution instead of O(n) scan. */
  private buildGroups(fetches: TracedFetch[], requests: TracedRequest[]): FetchGroup[] {
    const requestById = new Map<string, TracedRequest>();
    for (const req of requests) {
      requestById.set(req.id, req);
    }

    const groups: Record<string, FetchGroup> = {};

    for (const f of fetches) {
      const key = f.method + " " + f.url;
      if (!groups[key]) {
        groups[key] = {
          method: f.method, url: f.url, count: 0, totalDur: 0, maxDur: 0,
          errors: 0, callers: {}, statusCodes: {}, firstTs: f.timestamp, lastTs: f.timestamp,
        };
      }
      const g = groups[key];
      g.count++;
      g.totalDur += f.durationMs;
      if (f.durationMs > g.maxDur) g.maxDur = f.durationMs;
      if (f.statusCode >= 400) g.errors++;
      g.statusCodes[f.statusCode] = (g.statusCodes[f.statusCode] || 0) + 1;
      if (f.timestamp < g.firstTs) g.firstTs = f.timestamp;
      if (f.timestamp > g.lastTs) g.lastTs = f.timestamp;
      if (f.parentRequestId) {
        const parent = requestById.get(f.parentRequestId);
        if (parent) {
          g.callers[parent.method + " " + (parent.path || parent.url)] = 1;
        }
      }
    }

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }

  private renderSummary(fetches: TracedFetch[]) {
    const uniqueUrls = new Set<string>();
    let errCount = 0;
    let totalDur = 0;

    for (const f of fetches) {
      uniqueUrls.add(f.url);
      if (f.statusCode >= 400) errCount++;
      totalDur += f.durationMs;
    }

    const avgDur = Math.round(totalDur / fetches.length);

    return html`
      <div class="fetch-summary">
        <bk-stat-card value=${String(fetches.length)} label="Total Fetches"></bk-stat-card>
        <bk-stat-card value=${String(uniqueUrls.size)} label="Unique URLs"></bk-stat-card>
        <bk-stat-card value=${String(errCount)} label="Errors" color=${errCount > 0 ? "var(--red)" : ""}></bk-stat-card>
        <bk-stat-card value=${formatDuration(avgDur)} label="Avg Duration"></bk-stat-card>
      </div>
    `;
  }

  private formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  private renderGroup(g: FetchGroup) {
    const avgMs = Math.round(g.totalDur / g.count);
    const errRate = g.count > 0 ? Math.round((g.errors / g.count) * 100) : 0;
    const callerKeys = Object.keys(g.callers);

    const statusEntries = Object.entries(g.statusCodes);
    const primaryStatus = statusEntries.length > 0
      ? Number(statusEntries.sort((a, b) => b[1] - a[1])[0][0])
      : 0;

    return html`
      <div class="fetch-group">
        <div class="fetch-group-header">
          <bk-method-badge .method=${g.method}></bk-method-badge>
          <span class="fetch-group-url" title=${g.url}>${g.url}</span>
          ${primaryStatus > 0 ? html`<bk-status-pill .code=${primaryStatus}></bk-status-pill>` : nothing}
          <span class="fetch-group-count">${g.count}x</span>
        </div>
        <div class="fetch-group-meta">
          <span>avg ${formatDuration(avgMs)}</span>
          <span class="fetch-group-sep">\u00b7</span>
          <span>max ${formatDuration(g.maxDur)}</span>
          <span class="fetch-group-sep">\u00b7</span>
          ${errRate > 0
            ? html`<span class="fetch-group-err">${errRate}% errors</span>`
            : html`<span class="fetch-group-ok">0% errors</span>`}
        </div>
        ${g.firstTs > 0 ? html`
          <div class="fetch-group-timeline">
            <span class="fetch-group-timeline-dot"></span>
            <span class="fetch-group-timeline-range">
              ${this.formatTime(g.firstTs)}${g.firstTs !== g.lastTs ? html` \u2192 ${this.formatTime(g.lastTs)}` : nothing}
            </span>
          </div>` : nothing}
        ${callerKeys.length > 0 ? html`
          <div class="fetch-group-callers">
            <span class="fetch-group-callers-label">Called by</span>
            ${callerKeys.map((c) => html`<span class="fetch-group-caller-pill">${c}</span>`)}
          </div>` : nothing}
      </div>
    `;
  }

  render() {
    const fetches = this.store.state.fetches;
    const requests = this.store.state.requests;

    if (fetches.length === 0) {
      return html`<bk-empty-state title="No fetches" subtitle="No outbound HTTP calls have been captured yet"></bk-empty-state>`;
    }

    const groups = this.buildGroups(fetches, requests);

    return html`
      <div class="fetch-analysis" id="fetch-analysis">
        ${this.renderSummary(fetches)}
        ${groups.length > 0 ? html`
          <div class="fetch-groups-title">Grouped by URL (${groups.length})</div>
          <div class="fetch-groups">${groups.map((g) => this.renderGroup(g))}</div>
        ` : nothing}
      </div>
    `;
  }
}
