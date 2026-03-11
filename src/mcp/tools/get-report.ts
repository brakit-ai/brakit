import type { BrakitClient } from "../client.js";
import type { McpTool } from "../types.js";
import { MAX_RESOLVED_DISPLAY } from "../../constants/mcp.js";

export const getReport = {
  name: "get_report",
  description:
    "Generate a summary report of all findings: total found, open, resolved. " +
    "Use this to get a high-level overview of the application's health.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  async handler(client: BrakitClient, _args: Record<string, unknown>) {
    const [issuesData, metricsData] = await Promise.all([
      client.getIssues(),
      client.getLiveMetrics(),
    ]);

    const issues = issuesData.issues;
    const open = issues.filter((f) => f.state === "open" || f.state === "regressed");
    const resolved = issues.filter((f) => f.state === "resolved");
    const fixing = issues.filter((f) => f.state === "fixing");
    const stale = issues.filter((f) => f.state === "stale");

    const criticalOpen = open.filter((f) => f.issue.severity === "critical");
    const warningOpen = open.filter((f) => f.issue.severity === "warning");

    const securityIssues = issues.filter((f) => f.category === "security");
    const perfIssues = issues.filter((f) => f.category === "performance");

    const totalRequests = metricsData.endpoints.reduce(
      (s, ep) => s + ep.summary.totalRequests,
      0,
    );

    const lines: string[] = [
      "=== Brakit Report ===",
      "",
      `Endpoints observed: ${metricsData.endpoints.length}`,
      `Total requests captured: ${totalRequests}`,
      `Security issues: ${securityIssues.length}`,
      `Performance issues: ${perfIssues.length}`,
      "",
      "--- Issue Summary ---",
      `Total: ${issues.length}`,
      `  Open: ${open.length} (${criticalOpen.length} critical, ${warningOpen.length} warning)`,
      `  In progress: ${fixing.length}`,
      `  Resolved: ${resolved.length}`,
      `  Stale: ${stale.length}`,
    ];

    if (criticalOpen.length > 0) {
      lines.push("");
      lines.push("--- Critical Issues (fix first) ---");
      for (const f of criticalOpen) {
        lines.push(`  [CRITICAL] ${f.issue.title} — ${f.issue.endpoint ?? "global"}`);
        lines.push(`    ${f.issue.desc}`);
        lines.push(`    Fix: ${f.issue.hint}`);
      }
    }

    if (resolved.length > 0) {
      lines.push("");
      lines.push("--- Recently Resolved ---");
      for (const f of resolved.slice(0, MAX_RESOLVED_DISPLAY)) {
        lines.push(`  ✓ ${f.issue.title} — ${f.issue.endpoint ?? "global"}`);
      }
      if (resolved.length > MAX_RESOLVED_DISPLAY) {
        lines.push(`  ... and ${resolved.length - MAX_RESOLVED_DISPLAY} more`);
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
} satisfies McpTool;
