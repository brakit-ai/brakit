import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import type { TracedQuery } from "../../../types/index.js";
import { getQueryShape, getQueryInfo } from "../query-helpers.js";
import { getEndpointKey } from "../../../utils/endpoint.js";
import {
  MAX_DUPLICATE_INSIGHTS,
  CROSS_ENDPOINT_MIN_ENDPOINTS,
  CROSS_ENDPOINT_PCT,
  CROSS_ENDPOINT_MIN_OCCURRENCES,
} from "../../../constants/index.js";

// ── Duplicate API Call Detection ──
export const duplicateRule: InsightRule = {
  id: "duplicate",
  check(ctx: PreparedInsightContext): Insight[] {
    const dupCounts = new Map<string, number>();
    const flowCount = new Map<string, number>();

    for (const flow of ctx.flows) {
      if (!flow.requests) continue;
      const seenInFlow = new Set<string>();
      for (const fr of flow.requests) {
        if (!(fr as { isDuplicate?: boolean }).isDuplicate) continue;
        const dupKey = `${fr.method} ${(fr as { label?: string }).label ?? fr.path ?? fr.url}`;
        dupCounts.set(dupKey, (dupCounts.get(dupKey) ?? 0) + 1);
        if (!seenInFlow.has(dupKey)) {
          seenInFlow.add(dupKey);
          flowCount.set(dupKey, (flowCount.get(dupKey) ?? 0) + 1);
        }
      }
    }

    const dupEntries = [...dupCounts.entries()]
      .map(([key, count]) => ({ key, count, flows: flowCount.get(key) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const insights: Insight[] = [];
    for (let i = 0; i < Math.min(dupEntries.length, MAX_DUPLICATE_INSIGHTS); i++) {
      const d = dupEntries[i];
      insights.push({
        severity: "warning",
        type: "duplicate",
        title: "Duplicate API Call",
        desc: `${d.key} loaded ${d.count}x as duplicate across ${d.flows} action${d.flows !== 1 ? "s" : ""}`,
        hint: "Multiple components independently fetch the same endpoint. Lift the fetch to a parent component, use a data cache, or deduplicate with React Query / SWR.",
        nav: "actions",
      });
    }

    return insights;
  },
};

// ── Cross-Endpoint Query Detection ──
export const crossEndpointRule: InsightRule = {
  id: "cross-endpoint",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];
    const queryMap = new Map<string, { endpoints: Set<string>; count: number; first: TracedQuery }>();
    const allEndpoints = new Set<string>();

    for (const [reqId, reqQueries] of ctx.queriesByReq) {
      const req = ctx.reqById.get(reqId);
      if (!req) continue;
      const endpoint = getEndpointKey(req.method, req.path);
      allEndpoints.add(endpoint);

      const seenInReq = new Set<string>();
      for (const q of reqQueries) {
        const shape = getQueryShape(q);
        let entry = queryMap.get(shape);
        if (!entry) { entry = { endpoints: new Set(), count: 0, first: q }; queryMap.set(shape, entry); }
        entry.count++;
        if (!seenInReq.has(shape)) {
          seenInReq.add(shape);
          entry.endpoints.add(endpoint);
        }
      }
    }

    if (allEndpoints.size >= CROSS_ENDPOINT_MIN_ENDPOINTS) {
      for (const [, cem] of queryMap) {
        if (cem.count < CROSS_ENDPOINT_MIN_OCCURRENCES) continue;
        if (cem.endpoints.size < CROSS_ENDPOINT_MIN_ENDPOINTS) continue;
        const p = Math.round((cem.endpoints.size / allEndpoints.size) * 100);
        if (p < CROSS_ENDPOINT_PCT) continue;
        const info = getQueryInfo(cem.first);
        const label = info.op + (info.table ? ` ${info.table}` : "");
        insights.push({
          severity: "warning",
          type: "cross-endpoint",
          title: "Repeated Query Across Endpoints",
          desc: `${label} runs on ${cem.endpoints.size} of ${allEndpoints.size} endpoints (${p}%).`,
          hint: "This query runs on most of your endpoints. Load it once in middleware or cache the result to avoid redundant database calls.",
          nav: "queries",
        });
      }
    }

    return insights;
  },
};
