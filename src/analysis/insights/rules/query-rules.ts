import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import type { TracedQuery } from "../../../types/index.js";
import { getQueryShape, getQueryInfo } from "../query-helpers.js";
import { getEndpointKey } from "../../../utils/endpoint.js";
import {
  N1_QUERY_THRESHOLD,
  REDUNDANT_QUERY_MIN_COUNT,
  OVERFETCH_MIN_REQUESTS,
  HIGH_ROW_COUNT,
  MIN_REQUESTS_FOR_INSIGHT,
  HIGH_QUERY_COUNT_PER_REQ,
} from "../../../constants/index.js";
import { SELECT_STAR_RE, SELECT_DOT_STAR_RE } from "../../rules/patterns.js";

// ── N+1 Query Detection ──
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

// ── Redundant Query Detection ──
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

// ── SELECT * Detection ──
export const selectStarRule: InsightRule = {
  id: "select-star",
  check(ctx: PreparedInsightContext): Insight[] {
    const seen = new Map<string, number>();

    for (const [, reqQueries] of ctx.queriesByReq) {
      for (const q of reqQueries) {
        if (!q.sql) continue;
        const isSelectStar = SELECT_STAR_RE.test(q.sql.trim()) || SELECT_DOT_STAR_RE.test(q.sql);
        if (!isSelectStar) continue;
        const info = getQueryInfo(q);
        const key = info.table || "unknown";
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }

    const insights: Insight[] = [];
    for (const [table, count] of seen) {
      if (count < OVERFETCH_MIN_REQUESTS) continue;
      insights.push({
        severity: "warning",
        type: "select-star",
        title: "SELECT * Query",
        desc: `SELECT * on ${table} — ${count} occurrence${count !== 1 ? "s" : ""}`,
        hint: "SELECT * fetches all columns including ones you don\u2019t need. Specify only required columns to reduce data transfer and memory usage.",
        nav: "queries",
      });
    }

    return insights;
  },
};

// ── High Row Count Detection ──
export const highRowsRule: InsightRule = {
  id: "high-rows",
  check(ctx: PreparedInsightContext): Insight[] {
    const seen = new Map<string, { max: number; count: number }>();

    for (const [, reqQueries] of ctx.queriesByReq) {
      for (const q of reqQueries) {
        if (!q.rowCount || q.rowCount <= HIGH_ROW_COUNT) continue;
        const info = getQueryInfo(q);
        const key = `${info.op} ${info.table || "unknown"}`;
        let entry = seen.get(key);
        if (!entry) { entry = { max: 0, count: 0 }; seen.set(key, entry); }
        entry.count++;
        if (q.rowCount > entry.max) entry.max = q.rowCount;
      }
    }

    const insights: Insight[] = [];
    for (const [key, hrs] of seen) {
      if (hrs.count < OVERFETCH_MIN_REQUESTS) continue;
      insights.push({
        severity: "warning",
        type: "high-rows",
        title: "Large Result Set",
        desc: `${key} returns ${hrs.max}+ rows (${hrs.count}x)`,
        hint: "Fetching many rows slows responses and wastes memory. Add a LIMIT clause, implement pagination, or filter with a WHERE condition.",
        nav: "queries",
      });
    }

    return insights;
  },
};

// ── Query-Heavy Endpoint Detection ──
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
