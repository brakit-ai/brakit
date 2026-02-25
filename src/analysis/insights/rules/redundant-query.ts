import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import type { TracedQuery } from "../../../types/index.js";
import { getQueryInfo } from "../query-helpers.js";
import { getEndpointKey } from "../../../utils/endpoint.js";
import { REDUNDANT_QUERY_MIN_COUNT } from "../../../constants/thresholds.js";

export const redundantQueryRule: InsightRule = {
  id: "redundant-query",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];
    const seen = new Set<string>();

    for (const [reqId, reqQueries] of ctx.queriesByReq) {
      const req = ctx.reqById.get(reqId);
      if (!req) continue;
      const endpoint = getEndpointKey(req.method, req.path);
      const exact = new Map<string, { count: number; first: TracedQuery }>();

      for (const q of reqQueries) {
        if (!q.sql) continue;
        let entry = exact.get(q.sql);
        if (!entry) { entry = { count: 0, first: q }; exact.set(q.sql, entry); }
        entry.count++;
      }

      for (const [, e] of exact) {
        if (e.count < REDUNDANT_QUERY_MIN_COUNT) continue;
        const info = getQueryInfo(e.first);
        const label = info.op + (info.table ? ` ${info.table}` : "");
        const dedupKey = `${endpoint}:${label}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        insights.push({
          severity: "warning",
          type: "redundant-query",
          title: "Redundant Query",
          desc: `${label} runs ${e.count}x with identical params in ${endpoint}.`,
          hint: "The exact same query with identical parameters runs multiple times in one request. Cache the first result or lift the query to a shared function.",
          nav: "queries",
        });
      }
    }

    return insights;
  },
};
