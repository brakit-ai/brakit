import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";
import type { SecuritySeverity } from "../../types/security.js";
import type { IssueState } from "../../types/issue-lifecycle.js";
import { enrichFindings } from "../enrichment.js";
import { VALID_SECURITY_SEVERITIES } from "../../constants/config.js";
import { isValidIssueState } from "../../utils/type-guards.js";

export const getFindings = {
  name: "get_findings",
  description:
    "Get all security findings and performance insights from the running app. " +
    "Returns enriched findings with actionable fix hints, endpoint context, and evidence. " +
    "Use this to understand what issues exist in the running application.",
  inputSchema: {
    type: "object" as const,
    properties: {
      severity: {
        type: "string",
        enum: ["critical", "warning"] satisfies SecuritySeverity[],
        description: "Filter by severity level",
      },
      state: {
        type: "string",
        enum: ["open", "fixing", "resolved", "stale", "regressed"] satisfies IssueState[],
        description: "Filter by issue state",
      },
    },
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    const severity = args.severity as string | undefined;
    const state = args.state as string | undefined;

    if (severity && !VALID_SECURITY_SEVERITIES.has(severity as SecuritySeverity)) {
      return { content: [{ type: "text" as const, text: `Invalid severity "${severity}". Use: critical, warning.` }], isError: true };
    }
    if (state && !isValidIssueState(state)) {
      return { content: [{ type: "text" as const, text: `Invalid state "${state}". Use: open, fixing, resolved, stale, regressed.` }], isError: true };
    }

    let findings = await enrichFindings(client);

    // Exclude won't-fix issues by default — the AI already decided these can't be resolved
    if (!state) {
      findings = findings.filter((f) => f.aiStatus !== "wont_fix");
    }

    if (severity) {
      findings = findings.filter((f) => f.severity === severity);
    }

    if (state) {
      const issuesData = await client.getIssues({ state });
      const issueIds = new Set(issuesData.issues.map((i) => i.issueId));
      findings = findings.filter((f) => issueIds.has(f.findingId));
    }

    if (findings.length === 0) {
      return { content: [{ type: "text" as const, text: "No findings detected. The application looks healthy." }] };
    }

    const lines: string[] = [
      `Found ${findings.length} issue(s). Full context included below — no need to call get_request_detail separately.`,
      `After fixing, call report_fixes ONCE with all results.\n`,
    ];

    for (const f of findings) {
      lines.push(`[${f.severity.toUpperCase()}] ${f.title}`);
      lines.push(`  ID: ${f.findingId}`);
      lines.push(`  Endpoint: ${f.endpoint}`);
      lines.push(`  Issue: ${f.description}`);
      if (f.context) {
        for (const ctxLine of f.context.split("\n")) {
          lines.push(`  ${ctxLine}`);
        }
      }
      lines.push(`  Fix: ${f.hint}`);
      if (f.aiStatus === "fixed") {
        lines.push(`  AI Status: fixed (awaiting verification)`);
        if (f.aiNotes) lines.push(`  AI Notes: ${f.aiNotes}`);
      }
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
} satisfies McpTool;
