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
      for (const request of flow.requests) {
        if (!request.isDuplicate) continue;
        const deduplicationKey = `${request.method} ${request.label ?? request.path ?? request.url}`;
        dupCounts.set(deduplicationKey, (dupCounts.get(deduplicationKey) ?? 0) + 1);
        if (!seenInFlow.has(deduplicationKey)) {
          seenInFlow.add(deduplicationKey);
          flowCount.set(deduplicationKey, (flowCount.get(deduplicationKey) ?? 0) + 1);
        }
      }
    }

    const dupEntries = [...dupCounts.entries()]
      .map(([key, count]) => ({ key, count, flows: flowCount.get(key) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const insights: Insight[] = [];
    for (let i = 0; i < Math.min(dupEntries.length, MAX_DUPLICATE_INSIGHTS); i++) {
      const duplicate = dupEntries[i];
      insights.push({
        severity: "warning",
        type: "duplicate",
        title: "Duplicate API Call",
        desc: `${duplicate.key} loaded ${duplicate.count}x as duplicate across ${duplicate.flows} action${duplicate.flows !== 1 ? "s" : ""}`,
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
      for (const query of reqQueries) {
        const shape = getQueryShape(query);
        let entry = queryMap.get(shape);
        if (!entry) {
          entry = { endpoints: new Set(), count: 0, first: query };
          queryMap.set(shape, entry);
        }
        entry.count++;
        if (!seenInReq.has(shape)) {
          seenInReq.add(shape);
          entry.endpoints.add(endpoint);
        }
      }
    }

    if (allEndpoints.size >= CROSS_ENDPOINT_MIN_ENDPOINTS) {
      for (const [, queryMetric] of queryMap) {
        if (queryMetric.count < CROSS_ENDPOINT_MIN_OCCURRENCES) continue;
        if (queryMetric.endpoints.size < CROSS_ENDPOINT_MIN_ENDPOINTS) continue;
        const coveragePct = Math.round((queryMetric.endpoints.size / allEndpoints.size) * 100);
        if (coveragePct < CROSS_ENDPOINT_PCT) continue;
        const info = getQueryInfo(queryMetric.first);
        const label = info.op + (info.table ? ` ${info.table}` : "");
        insights.push({
          severity: "warning",
          type: "cross-endpoint",
          title: "Repeated Query Across Endpoints",
          desc: `${label} runs on ${queryMetric.endpoints.size} of ${allEndpoints.size} endpoints (${coveragePct}%).`,
          hint: "This query runs on most of your endpoints. Load it once in middleware or cache the result to avoid redundant database calls.",
          nav: "queries",
        });
      }
    }

    return insights;
  },
};
