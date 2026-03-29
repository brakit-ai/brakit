/** <bk-security-view> — Security findings grouped by severity. */

import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { SEVERITY_MAP } from "../constants.js";
import type { StatefulIssue, GroupedIssue } from "../store/types.js";

@customElement("bk-security-view")
export class SecurityView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  render() {
    const all = (this.store.state.issues || []).slice();
    const open = all.filter((f) => f.state === "open" || f.state === "fixing" || f.state === "regressed");
    const resolved = all.filter((f) => f.state === "resolved");

    if (open.length === 0 && resolved.length === 0) {
      const hasData = this.store.state.requests.length > 0 || this.store.state.logs.length > 0 || this.store.state.queries.length > 0;
      if (!hasData) {
        return html`<bk-empty-state title="Waiting for requests..." subtitle="Start using your app to see security findings here"></bk-empty-state>`;
      }
      return html`
        <div class="sec-clear">
          <span class="sec-clear-icon">\u2713</span>
          <div class="sec-clear-text">
            <div class="sec-clear-title">All clear</div>
            <div class="sec-clear-sub">No security or quality issues detected this session</div>
          </div>
        </div>
      `;
    }

    let critCount = 0, warnCount = 0, infoCount = 0;
    for (const si of open) {
      const sev = si.issue.severity;
      if (sev === "critical") critCount++;
      else if (sev === "info") infoCount++;
      else warnCount++;
    }

    return html`
      <div id="security-content">
        ${this.renderSummary(open.length, resolved.length, critCount, warnCount, infoCount)}
        ${open.length === 0 && resolved.length > 0 ? html`
          <div class="sec-clear">
            <span class="sec-clear-icon">\u2713</span>
            <div class="sec-clear-text">
              <div class="sec-clear-title">All issues resolved</div>
              <div class="sec-clear-sub">${resolved.length} finding${resolved.length !== 1 ? "s were" : " was"} detected and fixed</div>
            </div>
          </div>
        ` : nothing}
        ${open.length > 0 ? this.renderOpenGroups(open) : nothing}
        ${resolved.length > 0 ? this.renderResolved(resolved) : nothing}
      </div>
    `;
  }

  private renderSummary(openCount: number, resolvedCount: number, critCount: number, warnCount: number, infoCount: number) {
    return html`
      <div class="sec-summary">
        <div class="sec-summary-left">
          <span class="sec-summary-count">${openCount}</span>
          <span class="sec-summary-label">open issue${openCount !== 1 ? "s" : ""}</span>
          ${resolvedCount > 0 ? html`<span class="sec-resolved-badge">${resolvedCount} resolved</span>` : nothing}
        </div>
        <div class="sec-summary-right">
          ${critCount > 0 ? html`<span class="sec-badge critical">${critCount} critical</span>` : nothing}
          ${warnCount > 0 ? html`<span class="sec-badge warning">${warnCount} warning</span>` : nothing}
          ${infoCount > 0 ? html`<span class="sec-badge info">${infoCount} info</span>` : nothing}
        </div>
      </div>
    `;
  }

  private renderOpenGroups(open: StatefulIssue[]) {
    const groups: Record<string, GroupedIssue> = {};
    const groupOrder: string[] = [];

    for (const sf of open) {
      const f = sf.issue;
      const key = f.rule;
      if (!groups[key]) {
        groups[key] = { rule: key, title: f.title, severity: f.severity, hint: f.hint, items: [] };
        groupOrder.push(key);
      }
      groups[key].items.push(sf);
    }

    groupOrder.sort((a, b) => {
      const sa = SEVERITY_MAP[groups[a].severity]?.sort ?? 2;
      const sb = SEVERITY_MAP[groups[b].severity]?.sort ?? 2;
      if (sa !== sb) return sa - sb;
      return groups[b].items.length - groups[a].items.length;
    });

    return html`${groupOrder.map((key) => this.renderGroup(groups[key]))}`;
  }

  private renderGroup(group: GroupedIssue) {
    const sevCfg = SEVERITY_MAP[group.severity] || SEVERITY_MAP["info"];
    return html`
      <div class="sec-group">
        <div class="sec-group-header">
          <span class="sec-group-icon ${sevCfg.cls}">${sevCfg.icon}</span>
          <span class="sec-group-title">${group.title}</span>
          <span class="sec-group-count">${group.items.length}</span>
        </div>
        ${group.hint ? html`<div class="sec-hint">${group.hint}</div>` : nothing}
        <div class="sec-items">${group.items.map((sf) => this.renderIssueItem(sf))}</div>
      </div>
    `;
  }

  private renderIssueItem(sf: StatefulIssue) {
    const item = sf.issue;
    return html`
      <div class="sec-item">
        <div class="sec-item-desc">${item.desc}</div>
        ${sf.occurrences > 1 ? html`<span class="sec-item-count">${sf.occurrences}x</span>` : nothing}
        ${sf.state === "fixing" && sf.aiStatus === "fixed"
          ? html`<span class="sec-ai-badge sec-ai-fixing">AI fixed \u2014 awaiting verification</span>`
          : sf.aiStatus === "wont_fix"
            ? html`<span class="sec-ai-badge sec-ai-wontfix">AI: won\u2019t fix</span>`
            : sf.state === "regressed"
              ? html`<span class="sec-ai-badge sec-ai-fixing" style="background:var(--red)">regressed</span>`
              : nothing}
        ${sf.aiNotes ? html`<div class="sec-ai-notes">${sf.aiNotes}</div>` : nothing}
      </div>
    `;
  }

  private renderResolved(resolved: StatefulIssue[]) {
    return html`
      <div class="sec-resolved-title">
        <span class="sec-resolved-check">\u2713</span> Resolved
        <span class="sec-resolved-count">${resolved.length}</span>
      </div>
      <div class="sec-group sec-group-resolved">
        <div class="sec-items">
          ${resolved.map((sf) => html`
            <div class="sec-item sec-item-resolved">
              <span class="sec-resolved-item-icon">\u2713</span>
              <div class="sec-item-desc">${sf.issue.title} \u2014 ${sf.issue.endpoint || "global"}</div>
              ${sf.aiStatus === "fixed" ? html`<span class="sec-ai-badge sec-ai-verified">Verified fix</span>` : nothing}
              ${sf.aiNotes ? html`<div class="sec-ai-notes">${sf.aiNotes}</div>` : nothing}
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
