/** <bk-insights-view> — Unified issue list with filter chips. */

import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { BkViewBase } from "./bk-view-base.js";
import { SEVERITY_MAP, CLEAN_HITS_FOR_RESOLUTION } from "../constants.js";
import { categorizeIssue, type IssueCategory } from "../constants/rules.js";
import { isNotStale } from "../utils/issue-filters.js";
import type { StatefulIssue, Severity } from "../store/types.js";

type InsightFilter = "all" | IssueCategory;

const FILTER_CHIPS: readonly { key: InsightFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "reliability", label: "Reliability" },
];

@customElement("bk-insights-view")
export class InsightsView extends BkViewBase {
  @state() private filter: InsightFilter = "all";
  @state() private expandedIdx = -1;
  @state() private showDismissed = false;

  private getFilteredIssues(nonStale: StatefulIssue[]): StatefulIssue[] {
    const filtered = this.filter === "all"
      ? nonStale
      : nonStale.filter((entry) => categorizeIssue(entry) === this.filter);

    return filtered.sort((a, b) => {
      const stateOrder = (s: string) => s === "open" || s === "regressed" ? 0 : s === "fixing" ? 1 : 2;
      const stateDelta = stateOrder(a.state) - stateOrder(b.state);
      if (stateDelta !== 0) return stateDelta;
      const sevA = SEVERITY_MAP[a.issue.severity as Severity]?.sort ?? 3;
      const sevB = SEVERITY_MAP[b.issue.severity as Severity]?.sort ?? 3;
      return sevA - sevB;
    });
  }

  private getCounts(nonStale: StatefulIssue[]): Record<InsightFilter, number> {
    const counts: Record<InsightFilter, number> = { all: nonStale.length, security: 0, performance: 0, reliability: 0 };
    for (const entry of nonStale) {
      counts[categorizeIssue(entry)]++;
    }
    return counts;
  }

  render() {
    const hasData = this.store.state.requests.length > 0 || this.store.state.queries.length > 0;
    if (!hasData) {
      return html`<bk-empty-state
        title="Waiting for requests..."
        subtitle="Start using your app to see insights here"
      ></bk-empty-state>`;
    }

    const nonStale = (this.store.state.issues || []).filter(isNotStale);
    const allFiltered = this.getFilteredIssues(nonStale);
    const counts = this.getCounts(nonStale);

    const open = allFiltered.filter((entry) => entry.state === "open" && entry.aiStatus !== "wont_fix");
    const regressed = allFiltered.filter((entry) => entry.state === "regressed" && entry.aiStatus !== "wont_fix");
    const verifying = allFiltered.filter((entry) => entry.state === "fixing");
    const resolved = allFiltered.filter((entry) => entry.state === "resolved");
    const dismissed = allFiltered.filter((entry) => entry.aiStatus === "wont_fix");

    let cardIdx = 0;

    return html`
      <div class="insights-filters">
        ${FILTER_CHIPS.map((chip) => html`
          <button class="insights-chip ${this.filter === chip.key ? "active" : ""}"
            @click=${() => { this.filter = chip.key; this.expandedIdx = -1; }}>
            ${chip.label}
            ${counts[chip.key] > 0 ? html`<span class="insights-chip-count">${counts[chip.key]}</span>` : nothing}
          </button>
        `)}
      </div>

      <div class="insights-list">
        ${open.length === 0 && regressed.length === 0 && verifying.length === 0 && resolved.length === 0 && dismissed.length === 0
          ? html`<div class="insights-empty"><span class="insights-empty-icon">\u2713</span>${this.filter === "all" ? "All clear \u2014 no issues detected" : `No ${this.filter} issues`}</div>`
          : nothing}

        ${regressed.length > 0 ? html`
          <div class="insights-section insights-section-regressed">
            <span class="insights-section-icon">\u21A9</span> Regressed
            <span class="insights-section-count">${regressed.length}</span>
          </div>
          ${regressed.map((entry) => this.renderIssueCard(entry, cardIdx++))}
        ` : nothing}

        ${open.length > 0 ? html`
          <div class="insights-section">
            <span class="insights-section-icon">\u25CF</span> Open
            <span class="insights-section-count">${open.length}</span>
          </div>
          ${open.map((entry) => this.renderIssueCard(entry, cardIdx++))}
        ` : nothing}

        ${verifying.length > 0 ? html`
          <div class="insights-section insights-section-verifying">
            <span class="insights-section-icon">\u29D7</span> Verifying
            <span class="insights-section-count">${verifying.length}</span>
          </div>
          ${verifying.map((entry) => this.renderIssueCard(entry, cardIdx++))}
        ` : nothing}

        ${resolved.length > 0 ? html`
          <div class="insights-section insights-section-resolved">
            <span class="insights-section-icon">\u2713</span> Resolved
            <span class="insights-section-count">${resolved.length}</span>
          </div>
          ${resolved.map((entry) => this.renderIssueCard(entry, cardIdx++))}
        ` : nothing}

        ${dismissed.length > 0 ? html`
          <div class="insights-section insights-section-dismissed" @click=${() => { this.showDismissed = !this.showDismissed; }}>
            <span class="insights-section-icon">${this.showDismissed ? "\u25BE" : "\u25B8"}</span> Won't Fix
            <span class="insights-section-count">${dismissed.length}</span>
          </div>
          ${this.showDismissed ? dismissed.map((entry) => this.renderIssueCard(entry, cardIdx++)) : nothing}
        ` : nothing}
      </div>
    `;
  }

  private renderIssueCard(entry: StatefulIssue, idx: number) {
    const issue = entry.issue;
    const severityConfig = SEVERITY_MAP[issue.severity] || SEVERITY_MAP["info"];
    const isExpanded = this.expandedIdx === idx;
    const isResolved = entry.state === "resolved";
    const isVerifying = entry.state === "fixing";
    const category = categorizeIssue(entry);

    return html`
      <div class="insights-card ${isExpanded ? "expanded" : ""} ${isResolved ? "resolved" : ""}"
        @click=${() => { this.expandedIdx = this.expandedIdx === idx ? -1 : idx; }}>
        <div class="insights-card-left">
          <span class="insights-sev ${severityConfig.cls}">${severityConfig.icon}</span>
        </div>
        <div class="insights-card-body">
          <div class="insights-card-header">
            <span class="insights-card-title ${isResolved ? "resolved" : ""}">${issue.title}</span>
            <span class="insights-card-cat">${category}</span>
            ${issue.count ? html`<span class="insights-card-count">${issue.count}\u00D7</span>` : nothing}
            ${entry.state === "regressed" ? html`<span class="insights-badge-regressed">regressed</span>` : nothing}
            ${isVerifying ? html`<span class="insights-badge-verifying">verifying</span>` : nothing}
            ${isResolved ? html`<span class="insights-badge-resolved">resolved</span>` : nothing}
          </div>
          <div class="insights-card-desc">${issue.desc}</div>
          ${issue.detail ? html`<div class="insights-card-detail">${issue.detail}</div>` : nothing}
          ${entry.cleanHitsSinceLastSeen > 0 ? html`
            <div class="insights-card-progress">${entry.cleanHitsSinceLastSeen}/${CLEAN_HITS_FOR_RESOLUTION} clean requests</div>
          ` : nothing}
          ${isExpanded && issue.hint ? html`<div class="insights-card-hint">${issue.hint}</div>` : nothing}
        </div>
        ${issue.hint ? html`<span class="insights-card-arrow">${isExpanded ? "\u2193" : "\u2192"}</span>` : nothing}
      </div>
    `;
  }
}
