import type { Insight, PreparedInsightContext, InsightType } from "./types.js";

export interface InsightRule {
  id: InsightType;
  check(ctx: PreparedInsightContext): Insight[];
}
