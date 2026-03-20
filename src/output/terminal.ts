import pc from "picocolors";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX } from "../constants/index.js";
import { TERMINAL_TRUNCATE_LENGTH } from "../constants/config.js";
import { SEVERITY_ICON } from "../constants/labels.js";
import type { Severity } from "../types/security.js";
import type { Issue } from "../types/issue-lifecycle.js";
import type { Services } from "../core/services.js";
import type { AnalysisUpdate } from "../core/event-bus.js";

const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
  critical: pc.red,
  warning: pc.yellow,
  info: pc.dim,
};

function print(line: string): void {
  process.stdout.write(line + "\n");
}

export function printBanner(proxyPort: number, targetPort: number): void {
  print("");
  print(`  ${pc.bold(pc.magenta("brakit"))} ${pc.dim(`v${VERSION}`)}`);
  print("");
  print(
    `  ${pc.dim("proxy")}      ${pc.bold(`http://localhost:${proxyPort}`)}`,
  );
  print(
    `  ${pc.dim("target")}     ${pc.dim(`http://localhost:${targetPort}`)}`,
  );
  print(
    `  ${pc.dim("dashboard")}  ${pc.bold(pc.magenta(`http://localhost:${proxyPort}${DASHBOARD_PREFIX}`))}`,
  );
  print("");
}

function severityIcon(severity: Severity): string {
  return SEVERITY_COLOR[severity](SEVERITY_ICON[severity]);
}

function colorTitle(severity: Severity, text: string): string {
  const color = SEVERITY_COLOR[severity];
  return severity === "info" ? color(text) : color(pc.bold(text));
}

function truncate(s: string, max = TERMINAL_TRUNCATE_LENGTH): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "\u2026";
}

function formatConsoleLine(issue: Issue, suffix?: string): string {
  const icon = severityIcon(issue.severity);
  const title = colorTitle(issue.severity, issue.title);
  const desc = pc.dim(truncate(issue.desc) + (suffix ?? ""));
  let line = `  ${icon} ${title} \u2014 ${desc}`;
  if (issue.detail) {
    line += `\n    ${pc.dim("\u2514 " + issue.detail)}`;
  }
  return line;
}

export function startTerminalInsights(
  services: Services,
  proxyPort: number,
): () => void {
  const bus = services.bus;
  const metricsStore = services.metricsStore;
  const printedKeys = new Set<string>();
  const resolvedKeys = new Set<string>();
  const dashUrl = `localhost:${proxyPort}${DASHBOARD_PREFIX}`;

  return bus.on("analysis:updated", ({ issues }: AnalysisUpdate) => {
    const newLines: string[] = [];
    const resolvedLines: string[] = [];
    const regressedLines: string[] = [];

    for (const si of issues) {
      if (si.state === "resolved") {
        if (resolvedKeys.has(si.issueId)) continue;
        resolvedKeys.add(si.issueId);
        printedKeys.delete(si.issueId);
        const title = pc.green(pc.bold(`\u2713 ${si.issue.title}`));
        const desc = pc.dim(truncate(si.issue.desc));
        resolvedLines.push(`  ${title} \u2014 ${desc} ${pc.green("resolved")}`);
        continue;
      }

      if (si.state === "regressed") {
        if (!printedKeys.has(si.issueId)) {
          printedKeys.add(si.issueId);
          resolvedKeys.delete(si.issueId);
          const title = pc.red(pc.bold(`\u26A0 ${si.issue.title}`));
          const desc = pc.dim(truncate(si.issue.desc));
          regressedLines.push(`  ${title} \u2014 ${desc} ${pc.red("regressed")}`);
        }
        continue;
      }

      resolvedKeys.delete(si.issueId);
      if (si.issue.severity === "info") continue;
      if (printedKeys.has(si.issueId)) continue;
      printedKeys.add(si.issueId);

      let suffix: string | undefined;
      if (si.issue.rule === "slow") {
        const endpoint = si.issue.endpoint;
        if (endpoint) {
          const ep = metricsStore.getEndpoint(endpoint);
          if (ep && ep.sessions.length > 1) {
            const prev = ep.sessions[ep.sessions.length - 2];
            suffix = ` (\u2191 from ${prev.p95DurationMs < 1000 ? prev.p95DurationMs + "ms" : (prev.p95DurationMs / 1000).toFixed(1) + "s"})`;
          }
        }
      }

      newLines.push(formatConsoleLine(si.issue, suffix));
    }

    if (newLines.length > 0) {
      print("");
      for (const line of newLines) print(line);
      print("");
      print(`  ${pc.magenta(pc.bold("brakit"))} ${pc.dim("\u2192")} ${pc.dim("Dashboard:")} ${pc.underline(`http://${dashUrl}`)}  ${pc.dim("or ask your AI:")} ${pc.bold('"Fix brakit findings"')}`);
    }

    if (regressedLines.length > 0) {
      print("");
      for (const line of regressedLines) print(line);
      print("");
      print(`  ${pc.magenta(pc.bold("brakit"))} ${pc.dim("\u2192")} ${pc.red("Issues came back after being resolved!")}`);
    }

    if (resolvedLines.length > 0) {
      print("");
      for (const line of resolvedLines) print(line);
      print("");
      print(`  ${pc.magenta(pc.bold("brakit"))} ${pc.dim("\u2192")} ${pc.green("Issues fixed!")}`);
    }
  });
}
