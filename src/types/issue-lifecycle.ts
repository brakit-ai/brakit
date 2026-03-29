export type { IssueState, IssueSource, IssueCategory, AiFixStatus } from "./shared.js";

import type { IssueCategory, IssueState, IssueSource, AiFixStatus, Severity } from "./shared.js";

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
  /** Occurrence count for rules that aggregate (e.g., N+1 query count). */
  count?: number;
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
   * since it was last seen. Used for evidence-based resolution:
   * after CLEAN_HITS_FOR_RESOLUTION clean hits the issue auto-resolves.
   */
  cleanHitsSinceLastSeen: number;
  aiStatus: AiFixStatus | null;
  aiNotes: string | null;
}

export interface IssuesData {
  version: 2;
  issues: StatefulIssue[];
}
