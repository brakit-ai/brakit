import type { Severity } from "./security.js";

export type IssueState = "open" | "fixing" | "resolved" | "stale" | "regressed";
export type IssueSource = "passive";
export type IssueCategory = "security" | "performance" | "reliability";
export type AiFixStatus = "fixed" | "wont_fix";

export interface Issue {
  category: IssueCategory;
  /** Rule identifier: "slow", "n1", "exposed-secret", etc. */
  rule: string;
  severity: Severity;
  title: string;
  desc: string;
  hint: string;
  detail?: string;
  /** Explicit endpoint key (e.g., "GET /api/users"). */
  endpoint?: string;
  /** Dashboard tab to link to (e.g., "requests", "queries", "security"). */
  nav?: string;
}

export interface StatefulIssue {
  /** Stable ID derived from rule + endpoint + description hash. */
  issueId: string;
  state: IssueState;
  source: IssueSource;
  category: IssueCategory;
  issue: Issue;
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt: number | null;
  occurrences: number;
  /**
   * Number of requests to this endpoint that did NOT reproduce the issue
   * since it was last seen. Used for evidence-based resolution.
   */
  cleanHitsSinceLastSeen: number;
  /** What AI reported after attempting a fix. */
  aiStatus: AiFixStatus | null;
  /** AI's summary of what was done or why it can't be fixed. */
  aiNotes: string | null;
}

export interface IssuesData {
  version: 2;
  issues: StatefulIssue[];
}
