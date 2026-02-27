import type { SecurityFinding } from "./security.js";

export type FindingState = "open" | "fixing" | "resolved";
export type FindingSource = "passive";

export interface StatefulFinding {
  /** Stable ID derived from rule + endpoint + description hash */
  findingId: string;
  state: FindingState;
  source: FindingSource;
  finding: SecurityFinding;
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt: number | null;
  occurrences: number;
}

export interface FindingsData {
  version: 1;
  findings: StatefulFinding[];
}
