import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { formatDuration, pct } from "../../../utils/format.js";
import { MIN_REQUESTS_FOR_INSIGHT, SLOW_ENDPOINT_THRESHOLD_MS } from "../../../constants/thresholds.js";

export const slowRule: InsightRule = {
  id: "slow",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const [ep, g] of ctx.endpointGroups) {
      if (g.total < MIN_REQUESTS_FOR_INSIGHT) continue;
      const avgMs = Math.round(g.totalDuration / g.total);
      if (avgMs < SLOW_ENDPOINT_THRESHOLD_MS) continue;

      const avgQueryMs = Math.round(g.totalQueryTimeMs / g.total);
      const avgFetchMs = Math.round(g.totalFetchTimeMs / g.total);
      const avgAppMs = Math.max(0, avgMs - avgQueryMs - avgFetchMs);

      const parts: string[] = [];
      if (avgQueryMs > 0) parts.push(`DB ${formatDuration(avgQueryMs)} ${pct(avgQueryMs, avgMs)}%`);
      if (avgFetchMs > 0) parts.push(`Fetch ${formatDuration(avgFetchMs)} ${pct(avgFetchMs, avgMs)}%`);
      if (avgAppMs > 0) parts.push(`App ${formatDuration(avgAppMs)} ${pct(avgAppMs, avgMs)}%`);

      const breakdown = parts.length > 0 ? ` [${parts.join(" · ")}]` : "";

      let detail: string | undefined;
      let slowestMs = 0;
      for (const [, sd] of g.queryShapeDurations) {
        const avgShapeMs = sd.totalMs / sd.count;
        if (avgShapeMs > slowestMs) {
          slowestMs = avgShapeMs;
          detail = `Slowest query: ${sd.label} — avg ${formatDuration(Math.round(avgShapeMs))} (${sd.count}x)`;
        }
      }

      insights.push({
        severity: "warning",
        type: "slow",
        title: "Slow Endpoint",
        desc: `${ep} — avg ${formatDuration(avgMs)}${breakdown}`,
        hint: avgQueryMs >= avgFetchMs && avgQueryMs >= avgAppMs
          ? "Most time is in database queries. Check the Queries tab for slow or redundant queries."
          : avgFetchMs >= avgQueryMs && avgFetchMs >= avgAppMs
            ? "Most time is in outbound HTTP calls. Check if upstream services are slow or if calls can be parallelized."
            : "Most time is in application code. Profile the handler for CPU-heavy operations or blocking calls.",
        detail,
        nav: "requests",
      });
    }

    return insights;
  },
};
