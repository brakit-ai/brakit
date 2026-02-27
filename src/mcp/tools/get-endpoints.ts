import type { BrakitClient } from "../client.js";
import type { McpTool, EndpointSortKey } from "../types.js";
import { enrichEndpoints } from "../enrichment.js";

const VALID_SORT_KEYS = new Set<EndpointSortKey>(["p95", "error_rate", "query_count", "requests"]);

export const getEndpoints = {
  name: "get_endpoints",
  description:
    "Get a summary of all observed API endpoints with performance stats. " +
    "Shows p95 latency, error rate, query count, and time breakdown for each endpoint. " +
    "Use this to identify which endpoints need attention.",
  inputSchema: {
    type: "object" as const,
    properties: {
      sort_by: {
        type: "string",
        enum: ["p95", "error_rate", "query_count", "requests"] satisfies EndpointSortKey[],
        description: "Sort endpoints by this metric (default: p95 latency)",
      },
    },
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    const sortBy = args.sort_by as string | undefined;

    if (sortBy && !VALID_SORT_KEYS.has(sortBy as EndpointSortKey)) {
      return { content: [{ type: "text" as const, text: `Invalid sort_by "${sortBy}". Use: p95, error_rate, query_count, requests.` }], isError: true };
    }

    const endpoints = await enrichEndpoints(client, sortBy as EndpointSortKey | undefined);

    if (endpoints.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No endpoints observed yet. Make some requests to your app first." }],
      };
    }

    const lines: string[] = [`${endpoints.length} endpoint(s) observed:\n`];

    for (const ep of endpoints) {
      lines.push(`${ep.endpoint}`);
      lines.push(`  p95: ${ep.p95Ms}ms | Errors: ${(ep.errorRate * 100).toFixed(1)}% | Queries: ${ep.avgQueryCount}/req | Requests: ${ep.totalRequests}`);
      lines.push(`  Time breakdown: DB ${ep.avgQueryTimeMs}ms + Fetch ${ep.avgFetchTimeMs}ms + App ${ep.avgAppTimeMs}ms`);
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
} satisfies McpTool;
