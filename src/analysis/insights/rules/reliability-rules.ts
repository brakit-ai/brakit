import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { formatDuration, pct } from "../../../utils/format.js";
import {
  MIN_REQUESTS_FOR_INSIGHT,
  ERROR_RATE_THRESHOLD_PCT,
  SLOW_ENDPOINT_THRESHOLD_MS,
  REGRESSION_PCT_THRESHOLD,
  REGRESSION_MIN_INCREASE_MS,
  REGRESSION_MIN_REQUESTS,
  QUERY_COUNT_REGRESSION_RATIO,
} from "../../../constants/index.js";

// ── Unhandled Error Detection ──
export const errorRule: InsightRule = {
  id: "error",
  check(ctx: PreparedInsightContext): Insight[] {
    if (ctx.errors.length === 0) return [];

    const insights: Insight[] = [];
    const groups = new Map<string, number>();
    for (const e of ctx.errors) {
      const name = e.name || "Error";
      groups.set(name, (groups.get(name) ?? 0) + 1);
    }

    for (const [name, cnt] of groups) {
      insights.push({
        severity: "critical",
        type: "error",
        title: "Unhandled Error",
        desc: `${name} — occurred ${cnt} time${cnt !== 1 ? "s" : ""}`,
        hint: "Unhandled errors crash request handlers. Wrap async code in try/catch or add error-handling middleware.",
        nav: "errors",
      });
    }

    return insights;
  },
};

// ── Error Hotspot Detection ──
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

// ── Performance Regression Detection ──
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

// ── Slow Endpoint Detection ──
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

      const breakdown = parts.length > 0 ? ` [${parts.join(" \u00b7 ")}]` : "";

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
