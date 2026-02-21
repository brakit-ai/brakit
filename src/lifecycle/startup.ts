import type { Server } from "node:http";
import type { ChildProcess } from "node:child_process";
import pc from "picocolors";
import { detectProject } from "../detect/project.js";
import { createProxyServer } from "../proxy/server.js";
import { onRequest } from "../proxy/request-log.js";
import { printBanner, createConsoleInsightListener } from "../output/terminal.js";
import {
  isTelemetryEnabled,
  initSession,
  recordRequestCount,
  recordInsightTypes,
  recordRulesTriggered,
} from "../telemetry/index.js";
import { spawnDevServer, spawnCustomCommand } from "../process/spawn.js";
import { DEFAULT_MAX_BODY_CAPTURE } from "../constants/index.js";
import type { BrakitConfig, DetectedProject } from "../types/index.js";
import { MetricsStore, FileMetricsPersistence, defaultQueryStore } from "../store/index.js";
import { createDashboardHandler } from "../dashboard/router.js";
import { AnalysisEngine } from "../analysis/engine.js";
import { findFreePortPair } from "../process/port.js";

export interface StartOptions {
  rootDir: string;
  proxyPort: number;
  showStatic: boolean;
  customCommand?: string;
}

export interface BrakitInstance {
  proxy: Server;
  devProcess: ChildProcess;
  metricsStore: MetricsStore;
  analysisEngine: AnalysisEngine;
  config: BrakitConfig;
  project: DetectedProject;
}

export async function startBrakit(opts: StartOptions): Promise<BrakitInstance> {
  const { rootDir, showStatic, customCommand } = opts;

  let proxyPort: number;
  try {
    proxyPort = await findFreePortPair(opts.proxyPort);
  } catch {
    console.error(pc.red(`\n  Could not find a free port starting from ${opts.proxyPort}.`));
    process.exit(1);
  }
  if (proxyPort !== opts.proxyPort) {
    console.log(pc.yellow(`  Port ${opts.proxyPort} is in use, using ${proxyPort} instead.`));
  }
  const targetPort = proxyPort + 1;

  let project: DetectedProject;

  if (customCommand) {
    project = {
      framework: "custom",
      devCommand: customCommand,
      devBin: "",
      defaultPort: 3000,
      packageManager: "unknown",
    };
  } else {
    try {
      project = await detectProject(rootDir);
    } catch {
      console.error(pc.red("  Could not find package.json in " + rootDir));
      process.exit(1);
    }

    if (project.framework === "unknown") {
      console.error(pc.red("  Could not detect a supported framework."));
      console.error(pc.dim("  brakit supports: Next.js, Remix, Nuxt, Vite, Astro"));
      console.error(pc.dim("  Or use: npx brakit --command \"your dev command\""));
      process.exit(1);
    }
  }

  const config: BrakitConfig = {
    proxyPort,
    targetPort,
    showStatic,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
    customCommand,
  };

  const metricsStore = new MetricsStore(new FileMetricsPersistence(rootDir));
  metricsStore.start();

  const analysisEngine = new AnalysisEngine();
  analysisEngine.start();
  analysisEngine.onUpdate(createConsoleInsightListener(proxyPort, metricsStore));

  if (isTelemetryEnabled()) {
    initSession(project.framework, project.packageManager, !!customCommand, []);
    analysisEngine.onUpdate((insights, findings) => {
      recordInsightTypes(insights.map((i) => i.type));
      recordRulesTriggered(findings.map((f) => f.rule));
    });
  }

  const handleDashboard = createDashboardHandler({ metricsStore, analysisEngine });

  console.log(pc.dim(`  Starting ${project.devCommand} on port ${targetPort}...`));

  const devProcess = customCommand
    ? spawnCustomCommand(customCommand, targetPort, proxyPort, rootDir)
    : spawnDevServer(project.devBin, targetPort, proxyPort, rootDir);

  const proxy = createProxyServer(config, handleDashboard);

  proxy.on("error", (err: NodeJS.ErrnoException) => {
    devProcess.kill("SIGTERM");
    console.error(pc.red(`\n  Proxy failed to start: ${err.message}`));
    process.exit(1);
  });

  proxy.listen(proxyPort, () => {
    printBanner(proxyPort, targetPort);
  });

  let reqCount = 0;
  onRequest((req) => {
    const queryCount = defaultQueryStore.getByRequest(req.id).length;
    metricsStore.recordRequest(req, queryCount);
    reqCount++;
    recordRequestCount(reqCount);
  });

  return { proxy, devProcess, metricsStore, analysisEngine, config, project };
}
