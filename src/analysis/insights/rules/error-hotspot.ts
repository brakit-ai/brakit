import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { MIN_REQUESTS_FOR_INSIGHT, ERROR_RATE_THRESHOLD_PCT } from "../../../constants/index.js";

export const errorHotspotRule: InsightRule = {
  id: "error-hotspot",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const [ep, g] of ctx.endpointGroups) {
      if (g.total < MIN_REQUESTS_FOR_INSIGHT) continue;
      const errorRate = Math.round((g.errors / g.total) * 100);
      if (errorRate >= ERROR_RATE_THRESHOLD_PCT) {
        insights.push({
          severity: "critical",
          type: "error-hotspot",
          title: "Error Hotspot",
          desc: `${ep} — ${errorRate}% error rate (${g.errors}/${g.total} requests)`,
          hint: "This endpoint frequently returns errors. Check the response bodies for error details and stack traces.",
          nav: "requests",
        });
      }
    }

    return insights;
  },
};
