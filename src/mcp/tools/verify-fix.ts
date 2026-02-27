import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";

export const verifyFix = {
  name: "verify_fix",
  description:
    "Verify whether a previously found security or performance issue has been resolved. " +
    "After you fix code, the user should trigger the endpoint again, then call this tool " +
    "to check if the finding still appears in Brakit's analysis.",
  inputSchema: {
    type: "object" as const,
    properties: {
      finding_id: {
        type: "string",
        description: "The finding ID to verify",
      },
      endpoint: {
        type: "string",
        description: "Alternatively, check if a specific endpoint still has issues (e.g. 'GET /api/users')",
      },
    },
  },
  async handler(client: BrakitClient, args: Record<string, unknown>) {
    const findingId = args.finding_id as string | undefined;
    const endpoint = args.endpoint as string | undefined;

    if (findingId !== undefined && findingId.trim() === "") {
      return { content: [{ type: "text" as const, text: "finding_id cannot be empty." }], isError: true };
    }
    if (endpoint !== undefined && endpoint.trim() === "") {
      return { content: [{ type: "text" as const, text: "endpoint cannot be empty." }], isError: true };
    }

    if (findingId) {
      const data = await client.getFindings();
      const finding = data.findings.find((f) => f.findingId === findingId);

      if (!finding) {
        return {
          content: [{
            type: "text" as const,
            text: `Finding ${findingId} not found. It may have already been resolved and cleaned up.`,
          }],
        };
      }

      if (finding.state === "resolved") {
        return {
          content: [{
            type: "text" as const,
            text: `RESOLVED: "${finding.finding.title}" on ${finding.finding.endpoint} is no longer detected. The fix worked.`,
          }],
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: [
            `STILL PRESENT: "${finding.finding.title}" on ${finding.finding.endpoint}`,
            `  State: ${finding.state}`,
            `  Last seen: ${new Date(finding.lastSeenAt).toISOString()}`,
            `  Occurrences: ${finding.occurrences}`,
            `  Issue: ${finding.finding.desc}`,
            `  Hint: ${finding.finding.hint}`,
            "",
            "Make sure the user has triggered the endpoint again after the fix, so Brakit can re-analyze.",
          ].join("\n"),
        }],
      };
    }

    if (endpoint) {
      const data = await client.getFindings();
      const endpointFindings = data.findings.filter(
        (f) => f.finding.endpoint === endpoint || f.finding.endpoint.endsWith(` ${endpoint}`),
      );

      if (endpointFindings.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No findings found for endpoint "${endpoint}". Either it's clean or it hasn't been analyzed yet.`,
          }],
        };
      }

      const open = endpointFindings.filter((f) => f.state === "open");
      const resolved = endpointFindings.filter((f) => f.state === "resolved");

      const lines: string[] = [
        `Endpoint: ${endpoint}`,
        `Open issues: ${open.length}`,
        `Resolved: ${resolved.length}`,
        "",
      ];

      for (const f of open) {
        lines.push(`  [${f.finding.severity}] ${f.finding.title}: ${f.finding.desc}`);
      }
      for (const f of resolved) {
        lines.push(`  [resolved] ${f.finding.title}`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }

    return {
      content: [{
        type: "text" as const,
        text: "Please provide either a finding_id or an endpoint to verify.",
      }],
    };
  },
} satisfies McpTool;
