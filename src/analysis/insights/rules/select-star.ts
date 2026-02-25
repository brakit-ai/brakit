import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { getQueryInfo } from "../query-helpers.js";
import { OVERFETCH_MIN_REQUESTS } from "../../../constants/thresholds.js";
import { SELECT_STAR_RE, SELECT_DOT_STAR_RE } from "../../rules/patterns.js";

export const selectStarRule: InsightRule = {
  id: "select-star",
  check(ctx: PreparedInsightContext): Insight[] {
    const seen = new Map<string, number>();

    for (const [, reqQueries] of ctx.queriesByReq) {
      for (const q of reqQueries) {
        if (!q.sql) continue;
        const isSelectStar = SELECT_STAR_RE.test(q.sql.trim()) || SELECT_DOT_STAR_RE.test(q.sql);
        if (!isSelectStar) continue;
        const info = getQueryInfo(q);
        const key = info.table || "unknown";
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }

    const insights: Insight[] = [];
    for (const [table, count] of seen) {
      if (count < OVERFETCH_MIN_REQUESTS) continue;
      insights.push({
        severity: "warning",
        type: "select-star",
        title: "SELECT * Query",
        desc: `SELECT * on ${table} — ${count} occurrence${count !== 1 ? "s" : ""}`,
        hint: "SELECT * fetches all columns including ones you don\u2019t need. Specify only required columns to reduce data transfer and memory usage.",
        nav: "queries",
      });
    }

    return insights;
  },
};
