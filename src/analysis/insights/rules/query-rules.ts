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
    const reportedKeys = new Set<string>();

    for (const [reqId, reqQueries] of ctx.queriesByReq) {
      const req = ctx.reqById.get(reqId);
      if (!req) continue;
      const endpoint = getEndpointKey(req.method, req.path);

      const shapeGroups = new Map<string, { count: number; distinctSql: Set<string>; first: typeof reqQueries[0] }>();
      for (const query of reqQueries) {
        const shape = getQueryShape(query);
        let group = shapeGroups.get(shape);
        if (!group) {
          group = { count: 0, distinctSql: new Set(), first: query };
          shapeGroups.set(shape, group);
        }
        group.count++;
        group.distinctSql.add(query.sql ?? shape);
      }

      for (const [, shapeGroup] of shapeGroups) {
        if (shapeGroup.count <= N1_QUERY_THRESHOLD || shapeGroup.distinctSql.size <= 1) continue;
        const info = getQueryInfo(shapeGroup.first);
        const key = `${endpoint}:${info.op}:${info.table || "unknown"}`;
        if (reportedKeys.has(key)) continue;
        reportedKeys.add(key);
        insights.push({
          severity: "critical",
          type: "n1",
          title: "N+1 Query Pattern",
          desc: `${endpoint} runs ${shapeGroup.count}x ${info.op} ${info.table} with different params in a single request`,
          hint: "This typically happens when fetching related data in a loop. Use a batch query, JOIN, or include/eager-load to fetch all records at once.",
          detail: `${shapeGroup.count} queries with ${shapeGroup.distinctSql.size} distinct param variations. Example: ${[...shapeGroup.distinctSql][0]?.slice(0, 100) ?? info.op + " " + info.table}`,
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
    const reportedKeys = new Set<string>();

    for (const [reqId, reqQueries] of ctx.queriesByReq) {
      const req = ctx.reqById.get(reqId);
      if (!req) continue;
      const endpoint = getEndpointKey(req.method, req.path);
      const identicalQueryMap = new Map<string, { count: number; first: TracedQuery }>();

      for (const query of reqQueries) {
        if (!query.sql) continue;
        let entry = identicalQueryMap.get(query.sql);
        if (!entry) {
          entry = { count: 0, first: query };
          identicalQueryMap.set(query.sql, entry);
        }
        entry.count++;
      }

      for (const [, entry] of identicalQueryMap) {
        if (entry.count < REDUNDANT_QUERY_MIN_COUNT) continue;
        const info = getQueryInfo(entry.first);
        const label = info.op + (info.table ? ` ${info.table}` : "");
        const deduplicationKey = `${endpoint}:${label}`;
        if (reportedKeys.has(deduplicationKey)) continue;
        reportedKeys.add(deduplicationKey);
        insights.push({
          severity: "warning",
          type: "redundant-query",
          title: "Redundant Query",
          desc: `${label} runs ${entry.count}x with identical params in ${endpoint}.`,
          hint: "The exact same query with identical parameters runs multiple times in one request. Cache the first result or lift the query to a shared function.",
          detail: entry.first.sql ? `Query: ${entry.first.sql.slice(0, 120)}` : undefined,
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
    const tableCounts = new Map<string, number>();

    for (const [, reqQueries] of ctx.queriesByReq) {
      for (const query of reqQueries) {
        if (!query.sql) continue;
        const isSelectStar = SELECT_STAR_RE.test(query.sql.trim()) || SELECT_DOT_STAR_RE.test(query.sql);
        if (!isSelectStar) continue;
        const info = getQueryInfo(query);
        const table = info.table || "unknown";
        tableCounts.set(table, (tableCounts.get(table) ?? 0) + 1);
      }
    }

    const insights: Insight[] = [];
    for (const [table, count] of tableCounts) {
      if (count < OVERFETCH_MIN_REQUESTS) continue;
      insights.push({
        severity: "warning",
        type: "select-star",
        title: "SELECT * Query",
        desc: `SELECT * on ${table} — ${count} occurrence${count !== 1 ? "s" : ""}`,
        hint: "SELECT * fetches all columns including ones you don\u2019t need. Specify only required columns to reduce data transfer and memory usage.",
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
      for (const query of reqQueries) {
        if (!query.rowCount || query.rowCount <= HIGH_ROW_COUNT) continue;
        const info = getQueryInfo(query);
        const key = `${info.op} ${info.table || "unknown"}`;
        let entry = seen.get(key);
        if (!entry) {
          entry = { max: 0, count: 0 };
          seen.set(key, entry);
        }
        entry.count++;
        if (query.rowCount > entry.max) entry.max = query.rowCount;
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

    for (const [endpointKey, group] of ctx.endpointGroups) {
      if (group.total < MIN_REQUESTS_FOR_INSIGHT) continue;
      const avgQueries = Math.round(group.queryCount / group.total);
      if (avgQueries > HIGH_QUERY_COUNT_PER_REQ) {
        insights.push({
          severity: "warning",
          type: "query-heavy",
          title: "Query-Heavy Endpoint",
          desc: `${endpointKey} — avg ${avgQueries} queries/request`,
          hint: "Too many queries per request increases latency. Combine queries with JOINs, use batch operations, or reduce the number of data fetches.",

        });
      }
    }

    return insights;
  },
};
