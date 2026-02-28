import type { Insight } from "../analysis/insights/types.js";

export type InsightState = "open" | "resolved";

export interface StatefulInsight {
  key: string;
  state: InsightState;
  insight: Insight;
  firstSeenAt: number;
  lastSeenAt: number;
  resolvedAt: number | null;
  /** Consecutive recompute cycles where the insight was not detected. */
  consecutiveAbsences: number;
}
