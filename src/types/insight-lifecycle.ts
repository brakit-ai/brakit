import type { Insight } from "../analysis/insights/types.js";
import type { AiFixStatus, FindingState } from "./finding-lifecycle.js";

export type InsightState = FindingState;

export interface StatefulInsight {
  key: string;
  state: InsightState;
  insight: Insight;
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt: number | null;
  /** Consecutive recompute cycles where the insight was not detected. */
  consecutiveAbsences: number;
  aiStatus: AiFixStatus | null;
  aiNotes: string | null;
}
