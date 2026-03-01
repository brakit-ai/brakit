import pc from "picocolors";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX } from "../constants/index.js";
import { TERMINAL_TRUNCATE_LENGTH } from "../constants/limits.js";
import { SEVERITY_ICON } from "../constants/severity.js";
import { extractEndpointFromDesc } from "../utils/endpoint.js";
import type { Severity } from "../types/security.js";
import type { Insight } from "../analysis/insights.js";
import type { ServiceRegistry } from "../core/service-registry.js";
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

function formatConsoleLine(insight: Insight, suffix?: string): string {
  const icon = severityIcon(insight.severity);
  const title = colorTitle(insight.severity, insight.title);
  const desc = pc.dim(truncate(insight.desc) + (suffix ?? ""));
  let line = `  ${icon} ${title} \u2014 ${desc}`;
  if (insight.detail) {
    line += `\n    ${pc.dim("\u2514 " + insight.detail)}`;
  }
  return line;
}

export function startTerminalInsights(
  registry: ServiceRegistry,
  proxyPort: number,
): () => void {
  const bus = registry.get("event-bus");
  const metricsStore = registry.get("metrics-store");
  const printedKeys = new Set<string>();
  const resolvedKeys = new Set<string>();
  const dashUrl = `localhost:${proxyPort}${DASHBOARD_PREFIX}`;

  return bus.on("analysis:updated", ({ statefulInsights }: AnalysisUpdate) => {
    const newLines: string[] = [];
    const resolvedLines: string[] = [];

    for (const si of statefulInsights) {
      if (si.state === "resolved") {
        if (resolvedKeys.has(si.key)) continue;
        resolvedKeys.add(si.key);
        printedKeys.delete(si.key);
        const title = pc.green(pc.bold(`\u2713 ${si.insight.title}`));
        const desc = pc.dim(truncate(si.insight.desc));
        resolvedLines.push(`  ${title} \u2014 ${desc} ${pc.green("resolved")}`);
        continue;
      }

      resolvedKeys.delete(si.key);
      if (si.insight.severity === "info") continue;
      if (printedKeys.has(si.key)) continue;
      printedKeys.add(si.key);

      let suffix: string | undefined;
      if (si.insight.type === "slow") {
        const endpoint = extractEndpointFromDesc(si.insight.desc);
        if (endpoint) {
          const ep = metricsStore.getEndpoint(endpoint);
          if (ep && ep.sessions.length > 1) {
            const prev = ep.sessions[ep.sessions.length - 2];
            suffix = ` (\u2191 from ${prev.p95DurationMs < 1000 ? prev.p95DurationMs + "ms" : (prev.p95DurationMs / 1000).toFixed(1) + "s"})`;
          }
        }
      }

      newLines.push(formatConsoleLine(si.insight, suffix));
    }

    if (newLines.length > 0) {
      print("");
      for (const line of newLines) print(line);
      print("");
      print(`  ${pc.magenta(pc.bold("brakit"))} ${pc.dim("\u2192")} ${pc.dim("Dashboard:")} ${pc.underline(`http://${dashUrl}`)}  ${pc.dim("or ask your AI:")} ${pc.bold('"Fix brakit findings"')}`);
    }

    if (resolvedLines.length > 0) {
      print("");
      for (const line of resolvedLines) print(line);
      print("");
      print(`  ${pc.magenta(pc.bold("brakit"))} ${pc.dim("\u2192")} ${pc.green("Issues fixed!")}`);
    }
  });
}
