import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { getQueryShape, getQueryInfo } from "../query-helpers.js";
import { getEndpointKey } from "../../../utils/endpoint.js";
import { N1_QUERY_THRESHOLD } from "../../../constants/thresholds.js";

export const n1Rule: InsightRule = {
  id: "n1",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];
    const seen = new Set<string>();

    for (const [reqId, reqQueries] of ctx.queriesByReq) {
      const req = ctx.reqById.get(reqId);
      if (!req) continue;
      const endpoint = getEndpointKey(req.method, req.path);

      const shapeGroups = new Map<string, { count: number; distinctSql: Set<string>; first: typeof reqQueries[0] }>();
      for (const q of reqQueries) {
        const shape = getQueryShape(q);
        let group = shapeGroups.get(shape);
        if (!group) { group = { count: 0, distinctSql: new Set(), first: q }; shapeGroups.set(shape, group); }
        group.count++;
        group.distinctSql.add(q.sql ?? shape);
      }

      for (const [, sg] of shapeGroups) {
        if (sg.count <= N1_QUERY_THRESHOLD || sg.distinctSql.size <= 1) continue;
        const info = getQueryInfo(sg.first);
        const key = `${endpoint}:${info.op}:${info.table || "unknown"}`;
        if (seen.has(key)) continue;
        seen.add(key);
        insights.push({
          severity: "critical",
          type: "n1",
          title: "N+1 Query Pattern",
          desc: `${endpoint} runs ${sg.count}x ${info.op} ${info.table} with different params in a single request`,
          hint: "This typically happens when fetching related data in a loop. Use a batch query, JOIN, or include/eager-load to fetch all records at once.",
          nav: "queries",
        });
      }
    }

    return insights;
  },
};
