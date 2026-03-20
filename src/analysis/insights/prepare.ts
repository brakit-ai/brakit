import type { TracedQuery, TracedRequest } from "../../types/index.js";
import type {
  InsightContext,
  PreparedInsightContext,
  EndpointGroup,
} from "./types.js";
import { groupBy, getOrCreate } from "../../utils/collections.js";
import { getEndpointKey } from "../../utils/endpoint.js";
import { DASHBOARD_PREFIX } from "../../constants/index.js";
import { isErrorStatus } from "../../utils/http-status.js";
import { INSIGHT_WINDOW_PER_ENDPOINT } from "../../constants/config.js";
import { getQueryShape, getQueryInfo } from "./query-helpers.js";

function emptyEndpointGroup(): EndpointGroup {
  return {
    total: 0,
    errors: 0,
    totalDuration: 0,
    queryCount: 0,
    totalSize: 0,
    totalQueryTimeMs: 0,
    totalFetchTimeMs: 0,
    queryShapeDurations: new Map(),
  };
}

/**
 * Limits analysis to the N most recent requests per endpoint so that old,
 * stale data does not skew insight calculations. The window size is
 * controlled by INSIGHT_WINDOW_PER_ENDPOINT.
 */
export function keepRecentPerEndpoint(
  requests: readonly TracedRequest[],
): TracedRequest[] {
  const byEndpoint = new Map<string, TracedRequest[]>();
  for (const request of requests) {
    const endpointKey = getEndpointKey(request.method, request.path);
    const list = getOrCreate(byEndpoint, endpointKey, () => []);
    list.push(request);
  }

  const windowed: TracedRequest[] = [];
  for (const [, reqs] of byEndpoint) {
    windowed.push(...reqs.slice(-INSIGHT_WINDOW_PER_ENDPOINT));
  }

  return windowed;
}

/**
 * Extract the set of endpoint keys that appear in the given requests.
 * Used by AnalysisEngine to determine which endpoints were active
 * during a recompute cycle for evidence-based issue resolution.
 */
function filterUserRequests(requests: readonly TracedRequest[]): TracedRequest[] {
  return requests.filter(
    (request) =>
      !request.isStatic &&
      !request.isHealthCheck &&
      (!request.path || !request.path.startsWith(DASHBOARD_PREFIX)),
  );
}

export function extractActiveEndpoints(
  requests: readonly TracedRequest[],
): Set<string> {
  const endpoints = new Set<string>();
  for (const request of filterUserRequests(requests)) {
    endpoints.add(getEndpointKey(request.method, request.path));
  }
  return endpoints;
}

function aggregateEndpointMetrics(
  recent: readonly TracedRequest[],
  queriesByReq: Map<string, TracedQuery[]>,
  fetchesByReq: Map<string, { durationMs: number }[]>,
): Map<string, EndpointGroup> {
  const endpointGroups = new Map<string, EndpointGroup>();
  for (const request of recent) {
    const endpointKey = getEndpointKey(request.method, request.path);
    const group = getOrCreate(endpointGroups, endpointKey, emptyEndpointGroup);
    group.total++;
    if (isErrorStatus(request.statusCode)) group.errors++;
    group.totalDuration += request.durationMs;
    group.totalSize += request.responseSize ?? 0;

    const reqQueries: TracedQuery[] = queriesByReq.get(request.id) ?? [];
    group.queryCount += reqQueries.length;
    for (const query of reqQueries) {
      group.totalQueryTimeMs += query.durationMs;
      const shape = getQueryShape(query);
      const info = getQueryInfo(query);
      const shapeDuration = getOrCreate(group.queryShapeDurations, shape, () => ({
        totalMs: 0,
        count: 0,
        label: info.op + (info.table ? ` ${info.table}` : ""),
      }));
      shapeDuration.totalMs += query.durationMs;
      shapeDuration.count++;
    }

    const reqFetches = fetchesByReq.get(request.id) ?? [];
    for (const fetch of reqFetches) {
      group.totalFetchTimeMs += fetch.durationMs;
    }
  }
  return endpointGroups;
}

/**
 * Collect request IDs that were marked as React Strict Mode duplicates.
 * Queries and fetches associated with these requests should be excluded
 * from insight analysis to avoid false positives.
 */
function collectStrictModeDupeIds(ctx: InsightContext): Set<string> {
  const ids = new Set<string>();
  for (const flow of ctx.flows) {
    for (const req of flow.requests) {
      if (req.isStrictModeDupe) ids.add(req.id);
    }
  }
  return ids;
}

/**
 * Pre-computes lookup tables (queries-by-request, fetches-by-request,
 * request-by-id) and aggregated per-endpoint metrics used by all insight
 * rules, so each rule can focus on detection logic rather than data wrangling.
 */
export function buildInsightContext(ctx: InsightContext): PreparedInsightContext {
  const strictModeDupeIds = collectStrictModeDupeIds(ctx);

  // Exclude strict mode dupe requests from analysis
  const nonStatic = filterUserRequests(ctx.requests)
    .filter((req) => !strictModeDupeIds.has(req.id));

  // Exclude queries and fetches belonging to strict mode dupe requests
  const filteredQueries = strictModeDupeIds.size > 0
    ? ctx.queries.filter((q) => !q.parentRequestId || !strictModeDupeIds.has(q.parentRequestId))
    : ctx.queries;
  const filteredFetches = strictModeDupeIds.size > 0
    ? ctx.fetches.filter((f) => !f.parentRequestId || !strictModeDupeIds.has(f.parentRequestId))
    : ctx.fetches;

  const queriesByReq = groupBy(filteredQueries, (query) => query.parentRequestId);
  const fetchesByReq = groupBy(filteredFetches, (fetch) => fetch.parentRequestId);

  const reqById = new Map(nonStatic.map((request) => [request.id, request]));

  const recent = keepRecentPerEndpoint(nonStatic);
  const endpointGroups = aggregateEndpointMetrics(recent, queriesByReq, fetchesByReq);

  return {
    ...ctx,
    nonStatic,
    queriesByReq,
    fetchesByReq,
    reqById,
    endpointGroups,
  };
}
