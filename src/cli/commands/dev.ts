import { defineCommand } from "citty";
import { resolve } from "node:path";
import pc from "picocolors";
import { detectProject } from "../../detect/project.js";
import { createProxyServer } from "../../proxy/server.js";
import { onRequest } from "../../proxy/request-log.js";
import { formatRequest, printBanner } from "../../output/terminal.js";
import { spawnDevServer } from "../../process/spawn.js";
import { pipeDevOutput } from "../../process/output-filter.js";
import { VERSION } from "../../index.js";
import { DEFAULT_MAX_BODY_CAPTURE, SHUTDOWN_TIMEOUT_MS } from "../../constants.js";
import type { BrakitConfig } from "../../types.js";
import { MetricsStore } from "../../store/metrics-store.js";
import { setMetricsStore } from "../../dashboard/api.js";
import { defaultQueryStore } from "../../store/query-store.js";

export default defineCommand({
  meta: {
    name: "brakit",
    version: VERSION,
    description: "Runtime request tracer for local development",
  },
  args: {
    dir: {
      type: "positional",
      description: "Project directory",
      required: false,
      default: ".",
    },
    port: {
      type: "string",
      description: "Port for brakit proxy",
      default: "3000",
    },
    "show-static": {
      type: "boolean",
      description: "Show static asset requests",
      default: false,
    },
  },
  async run({ args }) {
    const rootDir = resolve(args.dir as string);
    const proxyPort = parseInt(args.port as string, 10);
    const targetPort = proxyPort + 1;
    const showStatic = args["show-static"] as boolean;

    let project;
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

    const metricsStore = new MetricsStore(rootDir);
    setMetricsStore(metricsStore);
    metricsStore.start();

    console.log(pc.dim(`  Starting ${project.devCommand} on port ${targetPort}...`));
    const devProcess = spawnDevServer(project.devBin, targetPort, proxyPort, rootDir);

    const proxy = createProxyServer(config);

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
      if (!config.showStatic && req.isStatic) return;
      console.log(formatRequest(req));
    });

    onRequest((req) => {
      const queryCount = defaultQueryStore.getByRequest(req.id).length;
      metricsStore.recordRequest(req, queryCount);
    });

    pipeDevOutput(devProcess);

    let shuttingDown = false;
    const cleanup = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(pc.dim("\n  Shutting down..."));
      metricsStore.stop();
      proxy.close();
      devProcess.kill("SIGTERM");
      setTimeout(() => {
        devProcess.kill("SIGKILL");
        process.exit(0);
      }, SHUTDOWN_TIMEOUT_MS);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    devProcess.on("exit", (code) => {
      if (shuttingDown) return;
      console.log(pc.dim(`\n  Dev server exited with code ${code}`));
      proxy.close();
      process.exit(code ?? 1);
    });
  },
});
