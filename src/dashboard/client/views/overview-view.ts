/** <bk-overview-view> — Dashboard overview with summary stats and issue cards. */

import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { DashboardStore, dashboardContext } from "../store/dashboard-store.js";
import { formatDuration } from "../utils/format.js";
import {
  SEVERITY_MAP,
  VIEW_TITLES,
  DASHBOARD_PREFIX,
  NAV_LABELS,
  CLEAN_HITS_FOR_RESOLUTION,
} from "../constants.js";
import type { StatefulIssue } from "../store/types.js";

@customElement("bk-overview-view")
export class OverviewView extends LitElement {
  @consume({ context: dashboardContext })
  store!: DashboardStore;

  @state() private expandedCardIdx = -1;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.addEventListener("state-changed", () => this.requestUpdate());
  }

  private navigateToView(view: string) {
    const buttons = document.querySelectorAll<HTMLElement>(".sidebar-item");
    for (const btn of buttons) {
      const label = btn.querySelector(".item-label");
      if (label && label.textContent?.trim() === (VIEW_TITLES[view] || view)) {
        btn.click();
        return;
      }
    }
  }

  private toggleCard(idx: number, e: Event) {
    let target = e.target as HTMLElement | null;
    while (target && target !== e.currentTarget) {
      if (target.classList?.contains("ov-card-link")) {
        const nav = target.getAttribute("data-nav");
        if (nav) this.navigateToView(nav);
        return;
      }
      target = target.parentElement;
    }
    this.expandedCardIdx = this.expandedCardIdx === idx ? -1 : idx;
  }

  render() {
    const s = this.store.state;
    const nonStatic = s.requests.filter(
      (r) => !r.isStatic && (!r.path || r.path.indexOf(DASHBOARD_PREFIX) !== 0),
    );
    const hasData = nonStatic.length > 0 || s.queries.length > 0 || s.errors.length > 0;

    if (!hasData) {
      return html`<bk-empty-state
        title="Waiting for requests..."
        subtitle="Start using your app to see insights here"
      ></bk-empty-state>`;
    }

    const errCount = nonStatic.filter((r) => r.statusCode >= 400).length;
    const avgMs =
      nonStatic.length > 0
        ? Math.round(nonStatic.reduce((sum, r) => sum + r.durationMs, 0) / nonStatic.length)
        : 0;

    const all = s.issues || [];
    const open = all.filter((si) => si.state === "open" || si.state === "regressed");
    const verifying = all.filter((si) => si.state === "fixing");
    const resolved = all.filter((si) => si.state === "resolved");

    return html`
      <div class="ov-container" id="overview-content">
        ${this.renderSummary(nonStatic.length, s.flows.length, avgMs, s.queries.length, errCount, s.fetches.length)}
        ${open.length === 0 && verifying.length === 0 && resolved.length === 0
          ? html`<div class="ov-clear">
              <span class="ov-clear-icon">\u2713</span>All clear \u2014 no issues detected
            </div>`
          : nothing}
        ${open.length === 0 && resolved.length > 0
          ? html`<div class="ov-clear">
              <span class="ov-clear-icon">\u2713</span>All issues resolved \u2014
              ${resolved.length} finding${resolved.length !== 1 ? "s were" : " was"} detected and
              fixed
            </div>`
          : nothing}
        ${open.length > 0 ? this.renderOpenIssues(open) : nothing}
        ${verifying.length > 0 ? this.renderVerifying(verifying) : nothing}
        ${resolved.length > 0 ? this.renderResolvedIssues(resolved) : nothing}
      </div>
    `;
  }

  private renderSummary(
    reqCount: number, flowCount: number, avgMs: number,
    queryCount: number, errCount: number, fetchCount: number,
  ) {
    return html`
      <div class="ov-summary">
        <div class="ov-stat"><span class="ov-stat-value">${reqCount}</span><span class="ov-stat-label">Requests</span></div>
        <div class="ov-stat"><span class="ov-stat-value">${flowCount}</span><span class="ov-stat-label">Actions</span></div>
        <div class="ov-stat"><span class="ov-stat-value">${formatDuration(avgMs)}</span><span class="ov-stat-label">Avg Response</span></div>
        <div class="ov-stat"><span class="ov-stat-value">${queryCount}</span><span class="ov-stat-label">Queries</span></div>
        <div class="ov-stat"><span class="ov-stat-value" style="color:${errCount > 0 ? "var(--red)" : "var(--green)"}">${errCount}</span><span class="ov-stat-label">Errors</span></div>
        <div class="ov-stat"><span class="ov-stat-value">${fetchCount}</span><span class="ov-stat-label">Fetches</span></div>
      </div>
    `;
  }

  private renderOpenIssues(open: StatefulIssue[]) {
    return html`
      <div class="ov-section-title">Issues Found <span class="ov-issue-count">${open.length}</span></div>
      <div class="ov-cards">${open.map((si, idx) => this.renderIssueCard(si, idx))}</div>
    `;
  }

  private renderIssueCard(si: StatefulIssue, idx: number) {
    const issue = si.issue;
    const sevCfg = SEVERITY_MAP[issue.severity] || SEVERITY_MAP["info"];
    const isExpanded = this.expandedCardIdx === idx;

    const aiBadge =
      si.aiStatus === "wont_fix"
        ? html`<span class="sec-ai-badge sec-ai-wontfix">AI: won\u2019t fix</span>`
        : si.state === "regressed"
          ? html`<span class="sec-ai-badge sec-ai-fixing" style="background:var(--red)">regressed</span>`
          : nothing;

    const resolvingHtml =
      si.cleanHitsSinceLastSeen > 0
        ? html`<div class="ov-card-resolving">Resolving\u2026 ${si.cleanHitsSinceLastSeen}/${CLEAN_HITS_FOR_RESOLUTION} clean requests</div>`
        : nothing;

    return html`
      <div class="ov-card ${isExpanded ? "expanded" : ""}" @click=${(e: Event) => this.toggleCard(idx, e)}>
        <span class="ov-card-icon ${sevCfg.cls}">${sevCfg.icon}</span>
        <div class="ov-card-body">
          <div class="ov-card-title">${issue.title}${aiBadge}</div>
          <div class="ov-card-desc">${issue.desc}</div>
          ${resolvingHtml}
          <div class="ov-card-expand" style="display:${isExpanded ? "block" : "none"}">
            ${issue.detail ? html`<div .innerHTML=${issue.detail}></div>` : nothing}
            ${issue.hint ? html`<div class="ov-card-hint">${issue.hint}</div>` : nothing}
            ${issue.nav
              ? html`<span class="ov-card-link" data-nav=${issue.nav}>View in ${NAV_LABELS[issue.nav] || issue.nav} \u2192</span>`
              : nothing}
          </div>
        </div>
        <span class="ov-card-arrow">${isExpanded ? "\u2193" : "\u2192"}</span>
      </div>
    `;
  }

  private renderVerifying(verifying: StatefulIssue[]) {
    return html`
      <div class="ov-section-title ov-resolved-title">
        <span style="color:var(--yellow,#f5a623)">\u29d7</span> Awaiting Verification
        <span class="ov-issue-count">${verifying.length}</span>
      </div>
      <div class="ov-cards">
        ${verifying.map((si) => {
          const issue = si.issue;
          const resolvingHtml =
            si.cleanHitsSinceLastSeen > 0
              ? html`<div class="ov-card-resolving">Verifying\u2026 ${si.cleanHitsSinceLastSeen}/${CLEAN_HITS_FOR_RESOLUTION} clean requests</div>`
              : nothing;
          return html`
            <div class="ov-card ov-card-resolved">
              <span class="ov-card-icon resolved">\u29d7</span>
              <div class="ov-card-body">
                <div class="ov-card-title" style="color:var(--text-muted)">
                  ${issue.title}
                  <span class="sec-ai-badge sec-ai-fixing">AI fixed \u2014 awaiting verification</span>
                </div>
                <div class="ov-card-desc">${issue.desc}</div>
                ${resolvingHtml}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderResolvedIssues(resolved: StatefulIssue[]) {
    return html`
      <div class="ov-section-title ov-resolved-title">
        <span style="color:var(--green)">\u2713</span> Resolved
        <span class="ov-issue-count">${resolved.length}</span>
      </div>
      <div class="ov-cards">
        ${resolved.map((si) => html`
          <div class="ov-card ov-card-resolved">
            <span class="ov-card-icon resolved">\u2713</span>
            <div class="ov-card-body">
              <div class="ov-card-title" style="text-decoration:line-through;color:var(--text-muted)">${si.issue.title}</div>
              <div class="ov-card-desc">${si.issue.desc}</div>
            </div>
          </div>
        `)}
      </div>
    `;
  }
}
