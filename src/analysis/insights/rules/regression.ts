import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { formatDuration } from "../../../utils/format.js";
import {
  REGRESSION_PCT_THRESHOLD,
  REGRESSION_MIN_INCREASE_MS,
  REGRESSION_MIN_REQUESTS,
  QUERY_COUNT_REGRESSION_RATIO,
} from "../../../constants/thresholds.js";

export const regressionRule: InsightRule = {
  id: "regression",
  check(ctx: PreparedInsightContext): Insight[] {
    if (!ctx.previousMetrics || ctx.previousMetrics.length === 0) return [];

    const insights: Insight[] = [];

    for (const epMetrics of ctx.previousMetrics) {
      if (epMetrics.sessions.length < 2) continue;

      const prev = epMetrics.sessions[epMetrics.sessions.length - 2];
      const current = epMetrics.sessions[epMetrics.sessions.length - 1];
      if (prev.requestCount < REGRESSION_MIN_REQUESTS || current.requestCount < REGRESSION_MIN_REQUESTS) continue;

      const p95Increase = current.p95DurationMs - prev.p95DurationMs;
      const p95PctChange = prev.p95DurationMs > 0
        ? Math.round((p95Increase / prev.p95DurationMs) * 100)
        : 0;

      if (p95Increase >= REGRESSION_MIN_INCREASE_MS && p95PctChange >= REGRESSION_PCT_THRESHOLD) {
        insights.push({
          severity: "warning",
          type: "regression",
          title: "Performance Regression",
          desc: `${epMetrics.endpoint} p95 degraded ${formatDuration(prev.p95DurationMs)} \u2192 ${formatDuration(current.p95DurationMs)} (+${p95PctChange}%)`,
          hint: "This endpoint is slower than the previous session. Check if recent code changes added queries or processing.",
          nav: "graph",
        });
      }

      if (prev.avgQueryCount > 0 && current.avgQueryCount > prev.avgQueryCount * QUERY_COUNT_REGRESSION_RATIO) {
        insights.push({
          severity: "warning",
          type: "regression",
          title: "Query Count Regression",
          desc: `${epMetrics.endpoint} queries/request increased ${prev.avgQueryCount} \u2192 ${current.avgQueryCount}`,
          hint: "This endpoint is making more database queries than before. Check for new N+1 patterns or removed query optimizations.",
          nav: "queries",
        });
      }
    }

    return insights;
  },
};
