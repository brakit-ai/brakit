import type { BrakitClient } from "./client.js";
import type {
  EnrichedFinding,
  EndpointSummary,
  RequestDetail,
  EndpointSortKey,
} from "./types.js";
import type { TracedRequest } from "../types/index.js";
import { ENRICHMENT_SEVERITY_FILTER } from "../constants/features.js";
import { parseEndpointKey } from "../utils/endpoint.js";

export async function enrichFindings(
  client: BrakitClient,
): Promise<EnrichedFinding[]> {
  const issuesData = await client.getIssues();
  const issues = issuesData.issues.filter(
    (si) => si.state !== "resolved" && si.state !== "stale",
  );

  const contexts = await Promise.all(
    issues.map(async (si): Promise<string> => {
      const endpoint = si.issue.endpoint;
      if (!endpoint) return si.issue.detail ?? "";
      try {
        const { path } = parseEndpointKey(endpoint);
        const reqData = await client.getRequests({ search: path, limit: 1 });
        if (reqData.requests.length > 0) {
          const req = reqData.requests[0];
          if (req.id) {
            const [activity, queries, fetches] = await Promise.all([
              client.getActivity(req.id),
              client.getQueries(req.id),
              client.getFetches(req.id),
            ]);
            const lines: string[] = [`Request took ${req.durationMs}ms.`];
            if (queries.entries.length > 0) {
              lines.push(`DB Queries (${queries.entries.length}):`);
              for (const q of queries.entries.slice(0, 5)) {
                const sql = q.sql ?? `${q.operation ?? ""} ${q.table ?? q.model ?? ""}`;
                lines.push(`  [${q.durationMs}ms] ${sql}`);
              }
              if (queries.entries.length > 5) lines.push(`  ... and ${queries.entries.length - 5} more`);
            }
            if (fetches.entries.length > 0) {
              lines.push(`Fetches (${fetches.entries.length}):`);
              for (const f of fetches.entries.slice(0, 3)) {
                lines.push(`  [${f.durationMs}ms] ${f.method} ${f.url} → ${f.statusCode}`);
              }
            }
            return lines.join("\n");
          }
        }
      } catch {
        return "(context unavailable)";
      }
      return si.issue.detail ?? "";
    }),
  );

  // Parallel arrays: issues[i] corresponds to contexts[i]
  const enriched: EnrichedFinding[] = [];

  for (let i = 0; i < issues.length; i++) {
    const si = issues[i];
    if (!ENRICHMENT_SEVERITY_FILTER.includes(si.issue.severity)) continue;

    enriched.push({
      findingId: si.issueId,
      severity: si.issue.severity,
      title: si.issue.title,
      endpoint: si.issue.endpoint ?? "global",
      description: si.issue.desc,
      hint: si.issue.hint,
      occurrences: si.occurrences,
      context: contexts[i],
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
