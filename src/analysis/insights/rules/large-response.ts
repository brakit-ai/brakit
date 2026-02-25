import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { formatSize } from "../../../utils/format.js";
import { OVERFETCH_MIN_REQUESTS, LARGE_RESPONSE_BYTES } from "../../../constants/thresholds.js";

export const largeResponseRule: InsightRule = {
  id: "large-response",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const [ep, g] of ctx.endpointGroups) {
      if (g.total < OVERFETCH_MIN_REQUESTS) continue;
      const avgSize = Math.round(g.totalSize / g.total);
      if (avgSize > LARGE_RESPONSE_BYTES) {
        insights.push({
          severity: "info",
          type: "large-response",
          title: "Large Response",
          desc: `${ep} — avg ${formatSize(avgSize)} response`,
          hint: "Large API responses increase network transfer time. Implement pagination, field filtering, or response compression.",
          nav: "requests",
        });
      }
    }

    return insights;
  },
};
