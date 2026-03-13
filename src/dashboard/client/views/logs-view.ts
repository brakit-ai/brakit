import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import type { TracedLog } from "../store/types.js";

@customElement("bk-logs-view")
export class LogsView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  private renderAnalysis(logs: TracedLog[]) {
    if (logs.length === 0) return nothing;

    const counts: Record<string, number> = { error: 0, warn: 0, info: 0, debug: 0, log: 0 };
    for (const l of logs) {
      if (counts[l.level] !== undefined) counts[l.level]++;
    }

    return html`
      <div id="log-analysis">
        <div class="fetch-summary">
          <bk-stat-card value=${String(logs.length)} label="Total Logs"></bk-stat-card>
          ${counts.error > 0
            ? html`<bk-stat-card value=${String(counts.error)} label="Errors" color="var(--red)"></bk-stat-card>`
            : nothing}
          ${counts.warn > 0
            ? html`<bk-stat-card value=${String(counts.warn)} label="Warnings" color="var(--amber)"></bk-stat-card>`
            : nothing}
          <bk-stat-card value=${String(counts.info)} label="Info"></bk-stat-card>
          ${counts.debug > 0
            ? html`<bk-stat-card value=${String(counts.debug)} label="Debug"></bk-stat-card>`
            : nothing}
          ${counts.log > 0
            ? html`<bk-stat-card value=${String(counts.log)} label="Log"></bk-stat-card>`
            : nothing}
        </div>
      </div>
    `;
  }

  private renderLogRow(l: TracedLog) {
    const ts = new Date(l.timestamp).toLocaleTimeString();

    return html`
      <div class="req-row">
        <span class="tel-level tel-level-${l.level}">${l.level.toUpperCase()}</span>
        <span class="tel-message tel-mono" title=${l.message}>${l.message}</span>
        <span class="tel-timestamp">${ts}</span>
      </div>
    `;
  }

  render() {
    const logs = this.store.state.logs;

    if (logs.length === 0) {
      return html`<bk-empty-state
        title="No logs"
        subtitle="No console output has been captured yet"
      ></bk-empty-state>`;
    }

    return html`
      ${this.renderAnalysis(logs)}
      <div class="col-header">
        <span style="width:52px">Level</span>
        <span style="flex:1">Message</span>
        <span style="width:130px;text-align:right">Time</span>
      </div>
      <div id="log-list">
        ${logs.map((l) => this.renderLogRow(l))}
      </div>
    `;
  }
}
