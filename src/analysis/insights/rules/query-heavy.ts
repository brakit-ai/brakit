import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { MIN_REQUESTS_FOR_INSIGHT, HIGH_QUERY_COUNT_PER_REQ } from "../../../constants/thresholds.js";

export const queryHeavyRule: InsightRule = {
  id: "query-heavy",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const [ep, g] of ctx.endpointGroups) {
      if (g.total < MIN_REQUESTS_FOR_INSIGHT) continue;
      const avgQueries = Math.round(g.queryCount / g.total);
      if (avgQueries > HIGH_QUERY_COUNT_PER_REQ) {
        insights.push({
          severity: "warning",
          type: "query-heavy",
          title: "Query-Heavy Endpoint",
          desc: `${ep} — avg ${avgQueries} queries/request`,
          hint: "Too many queries per request increases latency. Combine queries with JOINs, use batch operations, or reduce the number of data fetches.",
          nav: "queries",
        });
      }
    }

    return insights;
  },
};
