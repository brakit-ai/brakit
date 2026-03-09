import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";
import type { AiFixStatus } from "../../types/finding-lifecycle.js";
import { VALID_AI_FIX_STATUSES } from "../../constants/lifecycle.js";

export const reportFix = {
  name: "report_fix",
  description:
    "Report the result of fixing a brakit finding. Call this after attempting to fix each finding " +
    "to update the dashboard with the outcome. Use status 'fixed' when you've applied a fix, " +
    "or 'wont_fix' when the issue can't be resolved (e.g. third-party library, by design).",
  inputSchema: {
    type: "object" as const,
    properties: {
      finding_id: {
        type: "string",
        description: "The finding ID to report on",
      },
      status: {
        type: "string",
        description: "Whether the fix was applied or can't be fixed",
        enum: ["fixed", "wont_fix"] as const,
      },
      summary: {
        type: "string",
        description: "Brief description of what was done or why it can't be fixed",
      },
    },
    required: ["finding_id", "status", "summary"] as const,
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    const findingId = args.finding_id as string | undefined;
    const status = args.status as string | undefined;
    const summary = args.summary as string | undefined;

    if (!findingId || findingId.trim() === "") {
      return { content: [{ type: "text" as const, text: "finding_id is required." }], isError: true };
    }
    if (!status || !VALID_AI_FIX_STATUSES.has(status as AiFixStatus)) {
      return { content: [{ type: "text" as const, text: "status must be 'fixed' or 'wont_fix'." }], isError: true };
    }
    if (!summary || summary.trim() === "") {
      return { content: [{ type: "text" as const, text: "summary is required." }], isError: true };
    }

    const ok = await client.reportFix(findingId, status, summary);

    if (!ok) {
      return {
        content: [{ type: "text" as const, text: `Finding ${findingId} not found. It may have already been resolved.` }],
        isError: true,
      };
    }

    const label = status === "fixed" ? "marked as fixed (awaiting verification)" : "marked as won't fix";
    return {
      content: [{ type: "text" as const, text: `Finding ${findingId} ${label}. Dashboard updated.` }],
    };
  },
} satisfies McpTool;
