import pc from "picocolors";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX } from "../constants/index.js";
import type { Insight } from "../analysis/insights.js";
import type { AnalysisListener } from "../analysis/engine.js";
import type { MetricsStore } from "../store/index.js";

export function printBanner(proxyPort: number, targetPort: number): void {
  console.log();
  console.log(`  ${pc.bold(pc.magenta("brakit"))} ${pc.dim(`v${VERSION}`)}`);
  console.log();
  console.log(
    `  ${pc.dim("proxy")}      ${pc.bold(`http://localhost:${proxyPort}`)}`,
  );
  console.log(
    `  ${pc.dim("target")}     ${pc.dim(`http://localhost:${targetPort}`)}`,
  );
  console.log(
    `  ${pc.dim("dashboard")}  ${pc.bold(pc.magenta(`http://localhost:${proxyPort}${DASHBOARD_PREFIX}`))}`,
  );
  console.log();
}

function severityIcon(severity: string): string {
  if (severity === "critical") return pc.red("\u2717");
  if (severity === "warning") return pc.yellow("\u26A0");
  return pc.dim("\u25CB");
}

function colorTitle(severity: string, text: string): string {
  if (severity === "critical") return pc.red(pc.bold(text));
  if (severity === "warning") return pc.yellow(pc.bold(text));
  return pc.dim(text);
}

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "\u2026";
}

function formatConsoleLine(insight: Insight, dashboardUrl: string, suffix?: string): string {
  const icon = severityIcon(insight.severity);
  const title = colorTitle(insight.severity, insight.title);
  const desc = pc.dim(truncate(insight.desc) + (suffix ?? ""));
  const link = pc.dim(`\u2192  ${dashboardUrl}`);
  return `  ${icon} ${title} \u2014 ${desc}  ${link}`;
}

export function createConsoleInsightListener(
  proxyPort: number,
  metricsStore: MetricsStore,
): AnalysisListener {
  const printedKeys = new Set<string>();
  const dashUrl = `localhost:${proxyPort}${DASHBOARD_PREFIX}`;

  return (insights) => {
    const lines: string[] = [];

    for (const insight of insights) {
      if (insight.severity === "info") continue;
      const endpoint = insight.desc.match(/^(\S+\s+\S+)/)?.[1] ?? insight.desc;
      const key = `${insight.type}:${endpoint}`;
      if (printedKeys.has(key)) continue;
      printedKeys.add(key);

      let suffix: string | undefined;
      if (insight.type === "slow") {
        const ep = metricsStore.getAll().find((e) => e.endpoint === endpoint);
        if (ep && ep.sessions.length > 1) {
          const prev = ep.sessions[ep.sessions.length - 2];
          suffix = ` (\u2191 from ${prev.p95DurationMs < 1000 ? prev.p95DurationMs + "ms" : (prev.p95DurationMs / 1000).toFixed(1) + "s"})`;
        }
      }

      lines.push(formatConsoleLine(insight, dashUrl, suffix));
    }

    if (lines.length > 0) {
      console.log();
      for (const line of lines) console.log(line);
    }
  };
}
