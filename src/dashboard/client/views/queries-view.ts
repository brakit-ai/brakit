import { LitElement, html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { QUERY_OP_COLORS, SLOW_QUERY_THRESHOLD_MS } from "../constants.js";
import { formatDuration } from "../utils/format.js";
import { extractOp, extractTable, highlightSql } from "../utils/sql.js";
import type { TracedQuery } from "../store/types.js";

@customElement("bk-queries-view")
export class QueriesView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private expandedIdx = -1;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  private toggleQuery(idx: number) {
    this.expandedIdx = this.expandedIdx === idx ? -1 : idx;
  }

  private queryDuration(ms: number): string {
    if (ms === 0) return "<1ms";
    return formatDuration(ms);
  }

  private getQueryInfo(q: TracedQuery) {
    const op = (q.normalizedOp || q.operation || (q.sql ? extractOp(q.sql) : "?")).toUpperCase();
    const table = q.table || q.model || (q.sql ? extractTable(q.sql) : "");
    const sqlText = q.sql || (op + " " + table);
    return { op, table, sqlText };
  }

  private renderQueryRow(q: TracedQuery, idx: number) {
    const { op, table, sqlText } = this.getQueryInfo(q);
    const opColor = QUERY_OP_COLORS[op] || "var(--text-dim)";
    const isSlow = q.durationMs > SLOW_QUERY_THRESHOLD_MS;
    const preview = q.sql || (op + " " + table);
    const expanded = this.expandedIdx === idx;

    return html`
      <div>
        <div
          class="req-row query-row tel-clickable ${expanded ? "expanded" : ""}"
          @click=${() => this.toggleQuery(idx)}
        >
          <span class="query-op" title=${op} style="color:${opColor}">${op}</span>
          <span class="query-table" title=${table}>${table}</span>
          <span class="query-preview" title=${preview}>${preview}</span>
          <span class="query-dur${isSlow ? " query-slow" : ""}">${this.queryDuration(q.durationMs)}</span>
        </div>
        <div class="query-detail ${expanded ? "open" : ""}">
          ${expanded
            ? html`
                <pre class="query-detail-sql">${unsafeHTML(highlightSql(sqlText))}</pre>
                <bk-copy-button .text=${sqlText} label="Copy"></bk-copy-button>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  render() {
    const queries = this.store.state.queries;

    if (queries.length === 0) {
      return html`<bk-empty-state
        title="No queries"
        subtitle="No database queries have been captured yet"
      ></bk-empty-state>`;
    }

    return html`
      <div class="col-header">
        <span style="width:70px;border-right:1px solid var(--border);padding-right:16px">Operation</span>
        <span style="width:170px;border-right:1px solid var(--border);padding-right:16px">Table</span>
        <span style="flex:1;border-right:1px solid var(--border);padding-right:16px">Query</span>
        <span style="width:60px;text-align:right">Time</span>
      </div>
      <div id="query-list">
        ${queries.map((q, idx) => this.renderQueryRow(q, idx))}
      </div>
    `;
  }
}
