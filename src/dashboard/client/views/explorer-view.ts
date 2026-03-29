/** <bk-explorer-view> — Tabbed container for raw telemetry data. */

import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { BkViewBase } from "./bk-view-base.js";
import { API, DASHBOARD_PREFIX, EXPLORER_TABS, type ExplorerTab } from "../constants.js";

@customElement("bk-explorer-view")
export class ExplorerView extends BkViewBase {
  @state() private activeTab: ExplorerTab = "requests";

  private handleNavigateExplorer = (e: Event) => {
    const tab = (e as CustomEvent<ExplorerTab>).detail;
    if (EXPLORER_TABS.some((entry) => entry.key === tab)) {
      this.activeTab = tab;
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("navigate-explorer", this.handleNavigateExplorer);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("navigate-explorer", this.handleNavigateExplorer);
  }

  private switchTab(tab: ExplorerTab) {
    this.activeTab = tab;
    fetch(`${API.tab}?event=explorer.${tab}`).catch(() => {});
  }

  private getCount(tab: ExplorerTab): number {
    const state = this.store.state;
    switch (tab) {
      case "requests": return state.requests.filter((r) => !r.path?.startsWith(DASHBOARD_PREFIX)).length;
      case "fetches": return state.fetches.length;
      case "queries": return state.queries.length;
      case "logs": return state.logs.length;
      case "errors": return state.errors.length;
    }
  }

  render() {
    return html`
      <div class="explorer-tabs">
        ${EXPLORER_TABS.map((tab) => html`
          <button class="explorer-tab ${this.activeTab === tab.key ? "active" : ""}"
            @click=${() => this.switchTab(tab.key)}>
            ${tab.label}
            <span class="explorer-tab-count">${this.getCount(tab.key)}</span>
          </button>
        `)}
      </div>
      <div style="display:${this.activeTab === "requests" ? "block" : "none"}">
        <bk-requests-view></bk-requests-view>
      </div>
      <div style="display:${this.activeTab === "fetches" ? "block" : "none"}">
        <bk-fetches-view></bk-fetches-view>
      </div>
      <div style="display:${this.activeTab === "queries" ? "block" : "none"}">
        <bk-queries-view></bk-queries-view>
      </div>
      <div style="display:${this.activeTab === "logs" ? "block" : "none"}">
        <bk-logs-view></bk-logs-view>
      </div>
      <div style="display:${this.activeTab === "errors" ? "block" : "none"}">
        <bk-errors-view></bk-errors-view>
      </div>
    `;
  }
}
