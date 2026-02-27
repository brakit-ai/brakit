import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";

export const clearFindings = {
  name: "clear_findings",
  description:
    "Reset finding history for a fresh session. " +
    "Use this when you want to start tracking findings from scratch.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  async handler(client: BrakitClient, _args: Record<string, unknown>) {
    const ok = await client.clearAll();

    if (!ok) {
      return {
        content: [{ type: "text", text: "Failed to clear findings. Is the app still running?" }],
      };
    }

    return {
      content: [{ type: "text", text: "All findings and captured data have been cleared. Start making requests to capture fresh data." }],
    };
  },
} satisfies McpTool;
