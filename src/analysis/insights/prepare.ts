import type { TracedQuery, TracedRequest } from "../../types/index.js";
import type { InsightContext, PreparedInsightContext, EndpointGroup } from "./types.js";
import { groupBy } from "../../utils/collections.js";
import { getEndpointKey } from "../../utils/endpoint.js";
import { DASHBOARD_PREFIX } from "../../constants/index.js";
import { INSIGHT_WINDOW_PER_ENDPOINT } from "../../constants/thresholds.js";
import { getQueryShape, getQueryInfo } from "./query-helpers.js";

function createEndpointGroup(): EndpointGroup {
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

function windowByEndpoint(requests: readonly TracedRequest[]): TracedRequest[] {
  const byEndpoint = new Map<string, TracedRequest[]>();
  for (const r of requests) {
    const ep = getEndpointKey(r.method, r.path);
    let list = byEndpoint.get(ep);
    if (!list) { list = []; byEndpoint.set(ep, list); }
    list.push(r);
  }
  const windowed: TracedRequest[] = [];
  for (const [, reqs] of byEndpoint) {
    windowed.push(...reqs.slice(-INSIGHT_WINDOW_PER_ENDPOINT));
  }
  return windowed;
}

export function prepareContext(ctx: InsightContext): PreparedInsightContext {
  const nonStatic = ctx.requests.filter(
    (r) => !r.isStatic && (!r.path || !r.path.startsWith(DASHBOARD_PREFIX)),
  );

  const queriesByReq = groupBy(ctx.queries, (q) => q.parentRequestId);
  const fetchesByReq = groupBy(ctx.fetches, (f) => f.parentRequestId);

  const reqById = new Map(nonStatic.map((r) => [r.id, r]));

  const recent = windowByEndpoint(nonStatic);
  const endpointGroups = new Map<string, EndpointGroup>();
  for (const r of recent) {
    const ep = getEndpointKey(r.method, r.path);
    let g = endpointGroups.get(ep);
    if (!g) { g = createEndpointGroup(); endpointGroups.set(ep, g); }
    g.total++;
    if (r.statusCode >= 400) g.errors++;
    g.totalDuration += r.durationMs;
    g.totalSize += r.responseSize ?? 0;

    const reqQueries: TracedQuery[] = queriesByReq.get(r.id) ?? [];
    g.queryCount += reqQueries.length;
    for (const q of reqQueries) {
      g.totalQueryTimeMs += q.durationMs;
      const shape = getQueryShape(q);
      const info = getQueryInfo(q);
      let sd = g.queryShapeDurations.get(shape);
      if (!sd) {
        sd = { totalMs: 0, count: 0, label: info.op + (info.table ? ` ${info.table}` : "") };
        g.queryShapeDurations.set(shape, sd);
      }
      sd.totalMs += q.durationMs;
      sd.count++;
    }

    const reqFetches = fetchesByReq.get(r.id) ?? [];
    for (const f of reqFetches) {
      g.totalFetchTimeMs += f.durationMs;
    }
  }

  return {
    ...ctx,
    nonStatic,
    queriesByReq,
    fetchesByReq,
    reqById,
    endpointGroups,
  };
}
