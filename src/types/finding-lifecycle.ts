import type { SecurityFinding } from "./security.js";
import { FINDINGS_DATA_VERSION } from "../constants/limits.js";

export type FindingState = "open" | "fixing" | "resolved";
export type FindingSource = "passive";
export type AiFixStatus = "fixed" | "wont_fix";

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
  /** What AI reported after attempting a fix */
  aiStatus: AiFixStatus | null;
  /** AI's summary of what was done or why it can't be fixed */
  aiNotes: string | null;
}

export interface FindingsData {
  version: typeof FINDINGS_DATA_VERSION;
  findings: StatefulFinding[];
}
