import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { getQueryInfo } from "../query-helpers.js";
import { HIGH_ROW_COUNT, OVERFETCH_MIN_REQUESTS } from "../../../constants/index.js";

export const highRowsRule: InsightRule = {
  id: "high-rows",
  check(ctx: PreparedInsightContext): Insight[] {
    const seen = new Map<string, { max: number; count: number }>();

    for (const [, reqQueries] of ctx.queriesByReq) {
      for (const q of reqQueries) {
        if (!q.rowCount || q.rowCount <= HIGH_ROW_COUNT) continue;
        const info = getQueryInfo(q);
        const key = `${info.op} ${info.table || "unknown"}`;
        let entry = seen.get(key);
        if (!entry) { entry = { max: 0, count: 0 }; seen.set(key, entry); }
        entry.count++;
        if (q.rowCount > entry.max) entry.max = q.rowCount;
      }
    }

    const insights: Insight[] = [];
    for (const [key, hrs] of seen) {
      if (hrs.count < OVERFETCH_MIN_REQUESTS) continue;
      insights.push({
        severity: "warning",
        type: "high-rows",
        title: "Large Result Set",
        desc: `${key} returns ${hrs.max}+ rows (${hrs.count}x)`,
        hint: "Fetching many rows slows responses and wastes memory. Add a LIMIT clause, implement pagination, or filter with a WHERE condition.",
        nav: "queries",
      });
    }

    return insights;
  },
};
