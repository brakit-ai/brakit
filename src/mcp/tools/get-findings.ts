import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";
import type { SecuritySeverity } from "../../types/security.js";
import type { FindingState } from "../../types/finding-lifecycle.js";
import { enrichFindings } from "../enrichment.js";
import { VALID_SECURITY_SEVERITIES } from "../../constants/lifecycle.js";
import { isValidFindingState } from "../../utils/type-guards.js";

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
        enum: ["open", "fixing", "resolved"] satisfies FindingState[],
        description: "Filter by finding state (from finding lifecycle)",
      },
    },
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    const severity = args.severity as string | undefined;
    const state = args.state as string | undefined;

    if (severity && !VALID_SECURITY_SEVERITIES.has(severity as SecuritySeverity)) {
      return { content: [{ type: "text" as const, text: `Invalid severity "${severity}". Use: critical, warning.` }], isError: true };
    }
    if (state && !isValidFindingState(state)) {
      return { content: [{ type: "text" as const, text: `Invalid state "${state}". Use: open, fixing, resolved.` }], isError: true };
    }

    let findings = await enrichFindings(client);

    if (severity) {
      findings = findings.filter((f) => f.severity === severity);
    }

    if (state) {
      const stateful = await client.getFindings(state);
      const statefulIds = new Set(stateful.findings.map((f) => f.findingId));
      findings = findings.filter((f) => statefulIds.has(f.findingId));
    }

    if (findings.length === 0) {
      return { content: [{ type: "text" as const, text: "No findings detected. The application looks healthy." }] };
    }

    const lines: string[] = [`Found ${findings.length} issue(s):\n`];

    for (const f of findings) {
      lines.push(`[${f.severity.toUpperCase()}] ${f.title}`);
      lines.push(`  ID: ${f.findingId}`);
      lines.push(`  Endpoint: ${f.endpoint}`);
      lines.push(`  Issue: ${f.description}`);
      if (f.context) lines.push(`  Context: ${f.context}`);
      lines.push(`  Fix: ${f.hint}`);
      if (f.aiStatus === "fixed") {
        lines.push(`  AI Status: fixed (awaiting verification)`);
        if (f.aiNotes) lines.push(`  AI Notes: ${f.aiNotes}`);
      } else if (f.aiStatus === "wont_fix") {
        lines.push(`  AI Status: won't fix`);
        if (f.aiNotes) lines.push(`  AI Notes: ${f.aiNotes}`);
      }
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
} satisfies McpTool;
