import type { BrakitClient } from "./client.js";
import type {
  EnrichedFinding,
  EndpointSummary,
  RequestDetail,
  EndpointSortKey,
} from "./types.js";
import type { TracedRequest } from "../types/index.js";
import { ENRICHMENT_SEVERITY_FILTER } from "../constants/mcp.js";
import { computeInsightId } from "../store/finding-id.js";
import { parseEndpointKey } from "../utils/endpoint.js";

export async function enrichFindings(
  client: BrakitClient,
): Promise<EnrichedFinding[]> {
  const [securityData, insightsData] = await Promise.all([
    client.getSecurityFindings(),
    client.getInsights(),
  ]);

  // Fetch context for all findings in parallel — each task does
  // getRequests → getActivity sequentially (data dependency), but
  // all findings run concurrently.
  const contexts = await Promise.all(
    securityData.findings.map(async (sf): Promise<string> => {
      try {
        const { path } = parseEndpointKey(sf.finding.endpoint);
        const reqData = await client.getRequests({ search: path, limit: 1 });
        if (reqData.requests.length > 0) {
          const req = reqData.requests[0];
          if (req.id) {
            const activity = await client.getActivity(req.id);
            const queryCount = activity.counts?.queries ?? 0;
            const fetchCount = activity.counts?.fetches ?? 0;
            return `Request took ${req.durationMs}ms. ${queryCount} DB queries, ${fetchCount} fetches.`;
          }
        }
      } catch {
        return "(context unavailable)";
      }
      return "";
    }),
  );

  const enriched: EnrichedFinding[] = securityData.findings.map((sf, i) => {
    const f = sf.finding;
    return {
      findingId: sf.findingId,
      severity: f.severity,
      title: f.title,
      endpoint: f.endpoint,
      description: f.desc,
      hint: f.hint,
      occurrences: f.count,
      context: contexts[i],
      aiStatus: sf.aiStatus,
      aiNotes: sf.aiNotes,
    };
  });

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
      aiStatus: si.aiStatus,
      aiNotes: si.aiNotes,
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
      return buildRequestDetail(client, data.requests[0]);
    }
  } else if (opts.endpoint) {
    const { method, path } = parseEndpointKey(opts.endpoint);
    const data = await client.getRequests({ method, search: path, limit: 1 });
    if (data.requests.length > 0) {
      return buildRequestDetail(client, data.requests[0]);
    }
  }

  return null;
}

async function buildRequestDetail(
  client: BrakitClient,
  req: TracedRequest,
): Promise<RequestDetail> {
  const [activity, queries, fetches] = await Promise.all([
    client.getActivity(req.id),
    client.getQueries(req.id),
    client.getFetches(req.id),
  ]);

  return {
    id: req.id,
    method: req.method,
    url: req.url,
    statusCode: req.statusCode,
    durationMs: req.durationMs,
    queries: queries.entries,
    fetches: fetches.entries,
    timeline: activity.timeline,
  };
}
