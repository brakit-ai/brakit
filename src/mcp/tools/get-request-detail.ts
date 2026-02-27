import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";
import { MAX_TIMELINE_EVENTS } from "../../constants/mcp.js";
import { enrichRequestDetail } from "../enrichment.js";

export const getRequestDetail = {
  name: "get_request_detail",
  description:
    "Get full details of a specific HTTP request including all DB queries it fired, " +
    "all fetches it made, the response, and a timeline of events. " +
    "Use this to deeply understand what happens when a specific endpoint is hit.",
  inputSchema: {
    type: "object" as const,
    properties: {
      request_id: {
        type: "string",
        description: "The specific request ID to look up",
      },
      endpoint: {
        type: "string",
        description: "Alternatively, get the latest request for an endpoint like 'GET /api/users'",
      },
    },
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    const requestId = args.request_id as string | undefined;
    const endpoint = args.endpoint as string | undefined;

    if (!requestId && !endpoint) {
      return {
        content: [{ type: "text", text: "Please provide either a request_id or an endpoint (e.g. 'GET /api/users')." }],
      };
    }

    const detail = await enrichRequestDetail(client, { requestId, endpoint });

    if (!detail) {
      return {
        content: [{ type: "text", text: `No request found for ${requestId ?? endpoint}.` }],
      };
    }

    const lines: string[] = [
      `Request: ${detail.method} ${detail.url}`,
      `Status: ${detail.statusCode}`,
      `Duration: ${detail.durationMs}ms`,
      "",
    ];

    if (detail.queries.length > 0) {
      lines.push(`DB Queries (${detail.queries.length}):`);
      for (const q of detail.queries) {
        const sql = q.sql ?? `${q.operation} ${q.table ?? q.model ?? ""}`;
        lines.push(`  [${q.durationMs}ms] ${sql}`);
      }
      lines.push("");
    }

    if (detail.fetches.length > 0) {
      lines.push(`Outgoing Fetches (${detail.fetches.length}):`);
      for (const f of detail.fetches) {
        lines.push(`  [${f.durationMs}ms] ${f.method} ${f.url} → ${f.statusCode}`);
      }
      lines.push("");
    }

    if (detail.timeline.length > 0) {
      lines.push(`Timeline (${detail.timeline.length} events):`);
      for (const event of detail.timeline.slice(0, MAX_TIMELINE_EVENTS)) {
        lines.push(`  ${event.type}: ${JSON.stringify(event.data)}`);
      }
      if (detail.timeline.length > MAX_TIMELINE_EVENTS) {
        lines.push(`  ... and ${detail.timeline.length - MAX_TIMELINE_EVENTS} more events`);
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
} satisfies McpTool;
