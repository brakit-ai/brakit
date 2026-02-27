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
    const [findingsData, securityData, insightsData, metricsData] = await Promise.all([
      client.getFindings(),
      client.getSecurityFindings(),
      client.getInsights(),
      client.getLiveMetrics(),
    ]);

    const findings = findingsData.findings;
    const open = findings.filter((f) => f.state === "open");
    const resolved = findings.filter((f) => f.state === "resolved");
    const fixing = findings.filter((f) => f.state === "fixing");

    const criticalOpen = open.filter((f) => f.finding.severity === "critical");
    const warningOpen = open.filter((f) => f.finding.severity === "warning");

    const totalRequests = metricsData.endpoints.reduce(
      (s, ep) => s + ep.summary.totalRequests,
      0,
    );

    const lines: string[] = [
      "=== Brakit Report ===",
      "",
      `Endpoints observed: ${metricsData.endpoints.length}`,
      `Total requests captured: ${totalRequests}`,
      `Active security rules: ${securityData.findings.length} finding(s)`,
      `Performance insights: ${insightsData.insights.length} insight(s)`,
      "",
      "--- Finding Summary ---",
      `Total: ${findings.length}`,
      `  Open: ${open.length} (${criticalOpen.length} critical, ${warningOpen.length} warning)`,
      `  In progress: ${fixing.length}`,
      `  Resolved: ${resolved.length}`,
    ];

    if (criticalOpen.length > 0) {
      lines.push("");
      lines.push("--- Critical Issues (fix first) ---");
      for (const f of criticalOpen) {
        lines.push(`  [CRITICAL] ${f.finding.title} — ${f.finding.endpoint}`);
        lines.push(`    ${f.finding.desc}`);
        lines.push(`    Fix: ${f.finding.hint}`);
      }
    }

    if (resolved.length > 0) {
      lines.push("");
      lines.push("--- Recently Resolved ---");
      for (const f of resolved.slice(0, MAX_RESOLVED_DISPLAY)) {
        lines.push(`  ✓ ${f.finding.title} — ${f.finding.endpoint}`);
      }
      if (resolved.length > MAX_RESOLVED_DISPLAY) {
        lines.push(`  ... and ${resolved.length - MAX_RESOLVED_DISPLAY} more`);
      }
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
} satisfies McpTool;
