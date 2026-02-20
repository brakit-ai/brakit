import type {
  TracedRequest,
  TracedQuery,
  TracedError,
  SecurityFinding,
} from "../types/index.js";
import type { RequestFlow } from "../types/index.js";
import { DASHBOARD_PREFIX } from "../constants/index.js";
import {
  N1_QUERY_THRESHOLD,
  ERROR_RATE_THRESHOLD_PCT,
  SLOW_ENDPOINT_THRESHOLD_MS,
  MIN_REQUESTS_FOR_INSIGHT,
  HIGH_QUERY_COUNT_PER_REQ,
  AUTH_OVERHEAD_PCT,
  LARGE_RESPONSE_BYTES,
  HIGH_ROW_COUNT,
  OVERFETCH_MIN_REQUESTS,
  CROSS_ENDPOINT_MIN_ENDPOINTS,
  CROSS_ENDPOINT_PCT,
  CROSS_ENDPOINT_MIN_OCCURRENCES,
  REDUNDANT_QUERY_MIN_COUNT,
  OVERFETCH_MIN_FIELDS,
  OVERFETCH_MIN_INTERNAL_IDS,
  OVERFETCH_NULL_RATIO,
} from "../constants/thresholds.js";
import { normalizeQueryParams, normalizeSQL } from "../instrument/adapters/normalize.js";
import { INTERNAL_ID_SUFFIX } from "./rules/patterns.js";

export type InsightSeverity = "critical" | "warning" | "info";
export type InsightType =
  | "n1" | "cross-endpoint" | "redundant-query" | "error" | "error-hotspot"
  | "duplicate" | "slow" | "query-heavy" | "auth-overhead"
  | "select-star" | "high-rows" | "large-response" | "response-overfetch" | "security";

export interface Insight {
  severity: InsightSeverity;
  type: InsightType;
  title: string;
  desc: string;
  hint: string;
  detail?: string;
  nav?: string;
}

export interface InsightContext {
  requests: readonly TracedRequest[];
  queries: readonly TracedQuery[];
  errors: readonly TracedError[];
  flows: readonly RequestFlow[];
  securityFindings?: readonly SecurityFinding[];
}

const AUTH_CATEGORIES = new Set(["auth-handshake", "auth-check", "middleware"]);

function getQueryShape(q: TracedQuery): string {
  if (q.sql) return normalizeQueryParams(q.sql) ?? "";
  return `${q.operation ?? q.normalizedOp ?? "?"}:${q.model ?? q.table ?? ""}`;
}

function getQueryInfo(q: TracedQuery): { op: string; table: string } {
  if (q.sql) return normalizeSQL(q.sql);
  return {
    op: q.normalizedOp ?? q.operation ?? "?",
    table: q.table ?? q.model ?? "",
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function computeInsights(ctx: InsightContext): Insight[] {
  const insights: Insight[] = [];

  const nonStatic = ctx.requests.filter(
    (r) => !r.isStatic && (!r.path || !r.path.startsWith(DASHBOARD_PREFIX)),
  );

  // Group queries by parent request
  const queriesByReq = new Map<string, TracedQuery[]>();
  for (const q of ctx.queries) {
    if (!q.parentRequestId) continue;
    let arr = queriesByReq.get(q.parentRequestId);
    if (!arr) { arr = []; queriesByReq.set(q.parentRequestId, arr); }
    arr.push(q);
  }

  const reqById = new Map<string, TracedRequest>();
  for (const r of nonStatic) reqById.set(r.id, r);

  // --- N+1: same query shape with different params in a single request ---
  const n1Seen = new Set<string>();
  for (const [reqId, reqQueries] of queriesByReq) {
    const req = reqById.get(reqId);
    if (!req) continue;
    const endpoint = `${req.method} ${req.path}`;

    const shapeGroups = new Map<string, { count: number; distinctSql: Set<string>; first: TracedQuery }>();
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
      if (n1Seen.has(key)) continue;
      n1Seen.add(key);
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

  // --- Cross-endpoint: same query shape across many endpoints ---
  const ceQueryMap = new Map<string, { endpoints: Set<string>; count: number; first: TracedQuery }>();
  const ceAllEndpoints = new Set<string>();
  for (const [reqId, reqQueries] of queriesByReq) {
    const req = reqById.get(reqId);
    if (!req) continue;
    const endpoint = `${req.method} ${req.path}`;
    ceAllEndpoints.add(endpoint);
    const seenInReq = new Set<string>();
    for (const q of reqQueries) {
      const shape = getQueryShape(q);
      let entry = ceQueryMap.get(shape);
      if (!entry) { entry = { endpoints: new Set(), count: 0, first: q }; ceQueryMap.set(shape, entry); }
      entry.count++;
      if (!seenInReq.has(shape)) {
        seenInReq.add(shape);
        entry.endpoints.add(endpoint);
      }
    }
  }
  if (ceAllEndpoints.size >= CROSS_ENDPOINT_MIN_ENDPOINTS) {
    for (const [, cem] of ceQueryMap) {
      if (cem.count < CROSS_ENDPOINT_MIN_OCCURRENCES) continue;
      if (cem.endpoints.size < CROSS_ENDPOINT_MIN_ENDPOINTS) continue;
      const pct = Math.round((cem.endpoints.size / ceAllEndpoints.size) * 100);
      if (pct < CROSS_ENDPOINT_PCT) continue;
      const info = getQueryInfo(cem.first);
      const label = info.op + (info.table ? ` ${info.table}` : "");
      insights.push({
        severity: "warning",
        type: "cross-endpoint",
        title: "Repeated Query Across Endpoints",
        desc: `${label} runs on ${cem.endpoints.size} of ${ceAllEndpoints.size} endpoints (${pct}%).`,
        hint: "This query runs on most of your endpoints. Load it once in middleware or cache the result to avoid redundant database calls.",
        nav: "queries",
      });
    }
  }

  // --- Redundant: exact same query (same params) in one request ---
  const rqSeen = new Set<string>();
  for (const [reqId, reqQueries] of queriesByReq) {
    const req = reqById.get(reqId);
    if (!req) continue;
    const endpoint = `${req.method} ${req.path}`;
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
      if (rqSeen.has(dedupKey)) continue;
      rqSeen.add(dedupKey);
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

  // --- Unhandled errors ---
  if (ctx.errors.length > 0) {
    const errGroups = new Map<string, number>();
    for (const e of ctx.errors) {
      const name = e.name || "Error";
      errGroups.set(name, (errGroups.get(name) ?? 0) + 1);
    }
    for (const [name, cnt] of errGroups) {
      insights.push({
        severity: "critical",
        type: "error",
        title: "Unhandled Error",
        desc: `${name} — occurred ${cnt} time${cnt !== 1 ? "s" : ""}`,
        hint: "Unhandled errors crash request handlers. Wrap async code in try/catch or add error-handling middleware.",
        nav: "errors",
      });
    }
  }

  // --- Endpoint aggregates ---
  const endpointGroups = new Map<string, { total: number; errors: number; totalDuration: number; queryCount: number; totalSize: number }>();
  for (const r of nonStatic) {
    const ep = `${r.method} ${r.path}`;
    let g = endpointGroups.get(ep);
    if (!g) { g = { total: 0, errors: 0, totalDuration: 0, queryCount: 0, totalSize: 0 }; endpointGroups.set(ep, g); }
    g.total++;
    if (r.statusCode >= 400) g.errors++;
    g.totalDuration += r.durationMs;
    g.queryCount += (queriesByReq.get(r.id) ?? []).length;
    g.totalSize += r.responseSize ?? 0;
  }

  // --- Error hotspots ---
  for (const [ep, g] of endpointGroups) {
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

  // --- Duplicate API calls across flows ---
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
  for (let i = 0; i < Math.min(dupEntries.length, 3); i++) {
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

  // --- Slow endpoints ---
  for (const [ep, g] of endpointGroups) {
    if (g.total < MIN_REQUESTS_FOR_INSIGHT) continue;
    const avgMs = Math.round(g.totalDuration / g.total);
    if (avgMs >= SLOW_ENDPOINT_THRESHOLD_MS) {
      insights.push({
        severity: "warning",
        type: "slow",
        title: "Slow Endpoint",
        desc: `${ep} — avg ${formatDuration(avgMs)} across ${g.total} request${g.total !== 1 ? "s" : ""}`,
        hint: "Consistently slow responses hurt user experience. Check the Queries tab to see if database queries are the bottleneck.",
        nav: "requests",
      });
    }
  }

  // --- Query-heavy endpoints ---
  for (const [ep, g] of endpointGroups) {
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

  // --- Auth overhead ---
  for (const flow of ctx.flows) {
    if (!flow.requests || flow.requests.length < 2) continue;
    let authMs = 0;
    let totalMs = 0;
    for (const r of flow.requests) {
      const dur = (r as { pollingDurationMs?: number }).pollingDurationMs ?? r.durationMs;
      totalMs += dur;
      if (AUTH_CATEGORIES.has((r as { category?: string }).category ?? "")) authMs += dur;
    }
    if (totalMs > 0 && authMs > 0) {
      const pct = Math.round((authMs / totalMs) * 100);
      if (pct >= AUTH_OVERHEAD_PCT) {
        insights.push({
          severity: "warning",
          type: "auth-overhead",
          title: "Auth Overhead",
          desc: `${flow.label} — ${pct}% of time (${formatDuration(authMs)}) spent in auth/middleware`,
          hint: "Auth checks consume a significant portion of this action. If using a third-party auth provider, check if session caching can reduce roundtrips.",
          nav: "actions",
        });
      }
    }
  }

  // --- SELECT * ---
  const selectStarSeen = new Map<string, number>();
  for (const [, reqQueries] of queriesByReq) {
    for (const q of reqQueries) {
      if (!q.sql) continue;
      const isSelectStar = /^SELECT\s+\*/i.test(q.sql.trim()) || /\.\*\s+FROM/i.test(q.sql);
      if (!isSelectStar) continue;
      const info = getQueryInfo(q);
      const key = info.table || "unknown";
      selectStarSeen.set(key, (selectStarSeen.get(key) ?? 0) + 1);
    }
  }
  for (const [table, count] of selectStarSeen) {
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

  // --- High row counts ---
  const highRowSeen = new Map<string, { max: number; count: number }>();
  for (const [, reqQueries] of queriesByReq) {
    for (const q of reqQueries) {
      if (!q.rowCount || q.rowCount <= HIGH_ROW_COUNT) continue;
      const info = getQueryInfo(q);
      const key = `${info.op} ${info.table || "unknown"}`;
      let entry = highRowSeen.get(key);
      if (!entry) { entry = { max: 0, count: 0 }; highRowSeen.set(key, entry); }
      entry.count++;
      if (q.rowCount > entry.max) entry.max = q.rowCount;
    }
  }
  for (const [key, hrs] of highRowSeen) {
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

  // --- Response overfetch: too many fields, internal IDs, null-heavy ---
  const overfetchSeen = new Set<string>();
  for (const r of nonStatic) {
    if (r.statusCode >= 400 || !r.responseBody) continue;
    const ep = `${r.method} ${r.path}`;
    if (overfetchSeen.has(ep)) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(r.responseBody); } catch { continue; }

    // Unwrap common wrappers ({ data: ... }, { result: ... })
    let target = parsed;
    if (target && typeof target === "object" && !Array.isArray(target)) {
      const keys = Object.keys(target as Record<string, unknown>);
      if (keys.length <= 2) {
        for (const wk of ["data", "result", "user", "item"]) {
          const val = (target as Record<string, unknown>)[wk];
          if (val && typeof val === "object") { target = val; break; }
        }
      }
    }

    // For arrays, inspect the first item
    const inspectObj = Array.isArray(target) && target.length > 0 ? target[0] : target;
    if (!inspectObj || typeof inspectObj !== "object" || Array.isArray(inspectObj)) continue;
    const fields = Object.keys(inspectObj as Record<string, unknown>);
    if (fields.length < OVERFETCH_MIN_FIELDS) continue;

    // Count internal ID fields
    let internalIdCount = 0;
    let nullCount = 0;
    for (const key of fields) {
      if (INTERNAL_ID_SUFFIX.test(key) || key === "id" || key === "_id") internalIdCount++;
      const val = (inspectObj as Record<string, unknown>)[key];
      if (val === null || val === undefined) nullCount++;
    }

    const nullRatio = nullCount / fields.length;
    const reasons: string[] = [];
    if (internalIdCount >= OVERFETCH_MIN_INTERNAL_IDS) reasons.push(`${internalIdCount} internal ID fields`);
    if (nullRatio >= OVERFETCH_NULL_RATIO) reasons.push(`${Math.round(nullRatio * 100)}% null fields`);
    if (fields.length >= OVERFETCH_MIN_FIELDS && reasons.length === 0 && fields.length >= 12) {
      reasons.push(`${fields.length} fields returned`);
    }

    if (reasons.length > 0) {
      overfetchSeen.add(ep);
      insights.push({
        severity: "info",
        type: "response-overfetch",
        title: "Response Overfetch",
        desc: `${ep} — ${reasons.join(", ")}`,
        hint: "This response returns more data than the client likely needs. Use a DTO or select only required fields to reduce payload size and avoid leaking internal structure.",
        nav: "requests",
      });
    }
  }

  // --- Large responses ---
  for (const [ep, g] of endpointGroups) {
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

  // --- Security findings ---
  if (ctx.securityFindings) {
    for (const f of ctx.securityFindings) {
      insights.push({
        severity: f.severity,
        type: "security",
        title: f.title,
        desc: f.desc,
        hint: f.hint,
        nav: "security",
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  insights.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return insights;
}
