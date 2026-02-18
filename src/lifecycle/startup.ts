import type { Server } from "node:http";
import type { ChildProcess } from "node:child_process";
import pc from "picocolors";
import { detectProject } from "../detect/project.js";
import { createProxyServer } from "../proxy/server.js";
import { onRequest } from "../proxy/request-log.js";
import { printBanner } from "../output/terminal.js";
import { spawnDevServer } from "../process/spawn.js";
import { DEFAULT_MAX_BODY_CAPTURE } from "../constants/index.js";
import type { BrakitConfig, DetectedProject } from "../types/index.js";
import { MetricsStore, FileMetricsPersistence, defaultQueryStore } from "../store/index.js";
import { createDashboardHandler } from "../dashboard/router.js";

export interface StartOptions {
  rootDir: string;
  proxyPort: number;
  showStatic: boolean;
}

export interface BrakitInstance {
  proxy: Server;
  devProcess: ChildProcess;
  metricsStore: MetricsStore;
  config: BrakitConfig;
  project: DetectedProject;
}

export async function startBrakit(opts: StartOptions): Promise<BrakitInstance> {
  const { rootDir, proxyPort, showStatic } = opts;
  const targetPort = proxyPort + 1;

  let project: DetectedProject;
  try {
    project = await detectProject(rootDir);
  } catch {
    console.error(pc.red("  Could not find package.json in " + rootDir));
    process.exit(1);
  }

  if (project.framework === "unknown") {
    console.error(pc.red("  Could not detect a supported framework."));
    console.error(pc.dim("  brakit currently supports: Next.js"));
    process.exit(1);
  }

  const config: BrakitConfig = {
    proxyPort,
    targetPort,
    showStatic,
    maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE,
  };

  const metricsStore = new MetricsStore(new FileMetricsPersistence(rootDir));
  metricsStore.start();

  const handleDashboard = createDashboardHandler({ metricsStore });

  console.log(pc.dim(`  Starting ${project.devCommand} on port ${targetPort}...`));
  const devProcess = spawnDevServer(project.devBin, targetPort, proxyPort, rootDir);

  const proxy = createProxyServer(config, handleDashboard);

  proxy.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(pc.red(`\n  Port ${proxyPort} is already in use.`));
      console.error(pc.dim(`  Try: npx brakit --port ${proxyPort + 2}`));
      devProcess.kill("SIGTERM");
      process.exit(1);
    }
  });

  proxy.listen(proxyPort, () => {
    printBanner(proxyPort, targetPort);
  });

  onRequest((req) => {
    const queryCount = defaultQueryStore.getByRequest(req.id).length;
    metricsStore.recordRequest(req, queryCount);
  });

  return { proxy, devProcess, metricsStore, config, project };
}
