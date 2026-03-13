import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import type { TracedError } from "../store/types.js";

@customElement("bk-errors-view")
export class ErrorsView extends LitElement {
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

  private toggleError(idx: number) {
    this.expandedIdx = this.expandedIdx === idx ? -1 : idx;
  }

  private renderErrorRow(e: TracedError, idx: number) {
    const ts = new Date(e.timestamp).toLocaleTimeString();
    const expanded = this.expandedIdx === idx;

    return html`
      <div
        class="req-row tel-clickable ${expanded ? "expanded" : ""}"
        @click=${() => this.toggleError(idx)}
      >
        <span class="tel-error-name" title=${e.name}>${e.name}</span>
        <span class="tel-message" title=${e.message}>${e.message}</span>
        <span class="tel-timestamp">${ts}</span>
      </div>
      ${expanded && e.stack
        ? html`<div class="error-stack">${e.stack}</div>`
        : nothing}
    `;
  }

  render() {
    const errors = this.store.state.errors;

    if (errors.length === 0) {
      return html`<bk-empty-state
        title="No errors"
        subtitle="No errors have been captured yet"
      ></bk-empty-state>`;
    }

    return html`
      <div class="col-header">
        <span style="width:180px">Type</span>
        <span style="flex:1">Message</span>
        <span style="width:130px;text-align:right">Time</span>
      </div>
      <div id="error-list">
        ${errors.map((e, idx) => this.renderErrorRow(e, idx))}
      </div>
    `;
  }
}
