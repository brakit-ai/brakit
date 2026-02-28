import { createHash } from "node:crypto";
import type { BrakitClient } from "./client.js";
import type {
  EnrichedFinding,
  EndpointSummary,
  RequestDetail,
  EndpointSortKey,
} from "./types.js";
import { ENRICHMENT_SEVERITY_FILTER } from "../constants/mcp.js";
import { computeFindingId } from "../store/finding-id.js";
import { parseEndpointKey } from "../utils/endpoint.js";

/**
 * Derive a stable ID for an insight (which lacks the `rule` field of SecurityFinding).
 * Uses the insight type as the rule equivalent.
 */
function computeInsightId(type: string, endpoint: string, desc: string): string {
  const key = `${type}:${endpoint}:${desc}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export async function enrichFindings(
  client: BrakitClient,
): Promise<EnrichedFinding[]> {
  const [securityData, insightsData] = await Promise.all([
    client.getSecurityFindings(),
    client.getInsights(),
  ]);

  const enriched: EnrichedFinding[] = [];

  for (const f of securityData.findings) {
    let context = "";
    try {
      const { path } = parseEndpointKey(f.endpoint);
      const reqData = await client.getRequests({ search: path, limit: 1 });
      if (reqData.requests.length > 0) {
        const req = reqData.requests[0];
        if (req.id) {
          const activity = await client.getActivity(req.id);
          const queryCount = activity.counts?.queries ?? 0;
          const fetchCount = activity.counts?.fetches ?? 0;
          context = `Request took ${req.durationMs}ms. ${queryCount} DB queries, ${fetchCount} fetches.`;
        }
      }
    } catch {
      context = "(context unavailable)";
    }

    enriched.push({
      findingId: computeFindingId(f),
      severity: f.severity,
      title: f.title,
      endpoint: f.endpoint,
      description: f.desc,
      hint: f.hint,
      occurrences: f.count,
      context,
    });
  }

  for (const si of insightsData.insights) {
    if (si.state === "resolved") continue;
    const i = si.insight;
    if (!ENRICHMENT_SEVERITY_FILTER.includes(i.severity)) continue;

    const endpoint = i.nav ?? "global";
    enriched.push({
      findingId: computeInsightId(i.type, endpoint, i.desc),
      severity: i.severity,
      title: i.title,
      endpoint,
      description: i.desc,
      hint: i.hint,
      occurrences: 1,
      context: i.detail ?? "",
    });
  }

  return enriched;
}

export async function enrichEndpoints(
  client: BrakitClient,
  sortBy?: EndpointSortKey,
): Promise<EndpointSummary[]> {
  const data = await client.getLiveMetrics();
  const endpoints = data.endpoints.map((ep): EndpointSummary => ({
    ...ep.summary,
    endpoint: ep.endpoint,
  }));

  if (sortBy === "error_rate") {
    endpoints.sort((a, b) => b.errorRate - a.errorRate);
  } else if (sortBy === "query_count") {
    endpoints.sort((a, b) => b.avgQueryCount - a.avgQueryCount);
  } else if (sortBy === "requests") {
    endpoints.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  return endpoints;
}

export async function enrichRequestDetail(
  client: BrakitClient,
  opts: { requestId?: string; endpoint?: string },
): Promise<RequestDetail | null> {
  if (opts.requestId) {
    const data = await client.getRequests({ search: opts.requestId, limit: 1 });
    if (data.requests.length > 0) {
      return buildRequestDetail(client, data.requests[0].id);
    }
  } else if (opts.endpoint) {
    const { method, path } = parseEndpointKey(opts.endpoint);
    const data = await client.getRequests({ method, search: path, limit: 1 });
    if (data.requests.length > 0) {
      return buildRequestDetail(client, data.requests[0].id);
    }
  }

  return null;
}

async function buildRequestDetail(
  client: BrakitClient,
  requestId: string,
): Promise<RequestDetail> {
  const [reqData, activity, queries, fetches] = await Promise.all([
    client.getRequests({ search: requestId, limit: 1 }),
    client.getActivity(requestId),
    client.getQueries(requestId),
    client.getFetches(requestId),
  ]);

  const req = reqData.requests[0];
  return {
    id: requestId,
    method: req.method,
    url: req.url,
    statusCode: req.statusCode,
    durationMs: req.durationMs,
    queries: queries.entries,
    fetches: fetches.entries,
    timeline: activity.timeline,
  };
}
