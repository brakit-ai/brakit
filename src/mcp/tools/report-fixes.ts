import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";
import { isValidAiFixStatus } from "../../utils/type-guards.js";

interface FixReport {
  finding_id: string;
  status: "fixed" | "wont_fix";
  summary: string;
}

export const reportFixes = {
  name: "report_fixes",
  description:
    "Report results for multiple findings in a single call. Use this instead of calling report_fix " +
    "repeatedly — it's faster and requires only one confirmation. Pass a JSON array string where " +
    "each item has finding_id, status ('fixed' or 'wont_fix'), and summary.",
  inputSchema: {
    type: "object" as const,
    properties: {
      fixes: {
        type: "string",
        description: 'JSON array of fix reports. Example: [{"finding_id":"abc123","status":"fixed","summary":"Added input validation"}]',
      },
    },
    required: ["fixes"] as const,
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    let fixes: FixReport[];
    try {
      const raw = typeof args.fixes === "string" ? JSON.parse(args.fixes) : args.fixes;
      if (!Array.isArray(raw) || raw.length === 0) {
        return { content: [{ type: "text" as const, text: "fixes must be a non-empty JSON array." }], isError: true };
      }
      fixes = raw.filter((item: unknown): item is FixReport =>
        typeof item === "object" && item !== null &&
        typeof (item as FixReport).finding_id === "string" &&
        typeof (item as FixReport).status === "string" &&
        typeof (item as FixReport).summary === "string",
      );
      if (fixes.length === 0) {
        return { content: [{ type: "text" as const, text: "No valid fix entries found. Each entry needs finding_id, status, and summary." }], isError: true };
      }
    } catch {
      return { content: [{ type: "text" as const, text: "fixes must be valid JSON." }], isError: true };
    }

    const results: string[] = [];
    let errors = 0;

    for (const fix of fixes) {
      if (!fix.finding_id || !isValidAiFixStatus(fix.status) || !fix.summary) {
        results.push(`✗ Invalid entry: ${fix.finding_id || "missing ID"}`);
        errors++;
        continue;
      }

      const ok = await client.reportFix(fix.finding_id, fix.status, fix.summary);
      if (ok) {
        const label = fix.status === "fixed" ? "fixed" : "won't fix";
        results.push(`✓ ${fix.finding_id} → ${label}`);
      } else {
        results.push(`✗ ${fix.finding_id} → not found`);
        errors++;
      }
    }

    const errorSuffix = errors > 0 ? ` (${errors} error${errors !== 1 ? "s" : ""})` : "";
    const summary = `Processed ${fixes.length} finding(s)${errorSuffix}. Dashboard updated.`;
    return {
      content: [{ type: "text" as const, text: summary + "\n\n" + results.join("\n") }],
      ...(errors > 0 ? { isError: true } : {}),
    };
  },
} satisfies McpTool;
