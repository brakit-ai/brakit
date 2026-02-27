import type { BrakitClient } from "../client.js";
import type { McpTool, McpToolResult, McpToolInputProperty } from "../types.js";
import { getFindings } from "./get-findings.js";
import { getEndpoints } from "./get-endpoints.js";
import { getRequestDetail } from "./get-request-detail.js";
import { verifyFix } from "./verify-fix.js";
import { getReport } from "./get-report.js";
import { clearFindings } from "./clear-findings.js";

const TOOL_MAP = new Map<string, McpTool>(
  [getFindings, getEndpoints, getRequestDetail, verifyFix, getReport, clearFindings]
    .map((t) => [t.name, t] as const),
);

export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, McpToolInputProperty>; required?: readonly string[] };
}> {
  return [...TOOL_MAP.values()].map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

export function handleToolCall(
  client: BrakitClient,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return Promise.resolve({
      content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
      isError: true,
    });
  }
  return tool.handler(client, args);
}
