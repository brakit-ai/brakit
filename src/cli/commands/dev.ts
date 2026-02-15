import { defineCommand } from "citty";
import { resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import pc from "picocolors";
import { detectProject } from "../../detect/project.js";
import { createProxyServer } from "../../proxy/server.js";
import { onRequest } from "../../proxy/request-log.js";
import { formatRequest, printBanner } from "../../output/terminal.js";
import type { BrakitConfig } from "../../types.js";

export default defineCommand({
  meta: {
    name: "brakit",
    version: "0.2.0",
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

    // 1. Detect project
    let project;
    try {
      project = await detectProject(rootDir);
    } catch {
      console.error(
        pc.red("  Could not find package.json in " + rootDir),
      );
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
      maxBodyCapture: 10240,
    };

    // 2. Start the dev server on targetPort
    console.log(
      pc.dim(`  Starting ${project.devCommand} on port ${targetPort}...`),
    );
    const devProcess = spawnDevServer(
      project.devBin,
      targetPort,
      rootDir,
    );

    // 3. Start the proxy
    const proxy = createProxyServer(config);

    proxy.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          pc.red(`\n  Port ${proxyPort} is already in use.`),
        );
        console.error(
          pc.dim(`  Try: npx brakit --port ${proxyPort + 2}`),
        );
        devProcess.kill("SIGTERM");
        process.exit(1);
      }
    });

    proxy.listen(proxyPort, () => {
      printBanner(proxyPort, targetPort);
    });

    // 4. Wire up terminal output
    onRequest((req) => {
      if (!config.showStatic && req.isStatic) return;
      console.log(formatRequest(req));
    });

    // 5. Pipe dev server output through (filter noise)
    const pipeDevOutput = (data: Buffer, stream: "stdout" | "stderr") => {
      const text = data.toString().trim();
      if (!text) return;
      for (const line of text.split("\n")) {
        if (shouldShowDevLine(line)) {
          const fn = stream === "stderr" ? console.error : console.log;
          fn(pc.dim(`  [next] ${line.slice(0, 200)}`));
        }
      }
    };
    devProcess.stdout?.on("data", (d: Buffer) => pipeDevOutput(d, "stdout"));
    devProcess.stderr?.on("data", (d: Buffer) => pipeDevOutput(d, "stderr"));

    // 6. Clean shutdown
    let shuttingDown = false;
    const cleanup = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(pc.dim("\n  Shutting down..."));
      proxy.close();
      devProcess.kill("SIGTERM");
      setTimeout(() => {
        devProcess.kill("SIGKILL");
        process.exit(0);
      }, 3000);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    devProcess.on("exit", (code) => {
      if (shuttingDown) return;
      console.log(
        pc.dim(`\n  Dev server exited with code ${code}`),
      );
      proxy.close();
      process.exit(code ?? 1);
    });
  },
});

// Only show meaningful Next.js output — skip minified code, build chunks,
// and request logs (brakit already shows those with more detail).
function shouldShowDevLine(line: string): boolean {
  // Skip lines that are clearly minified/bundled code (very long, no spaces)
  if (line.length > 300) return false;

  // Skip empty or whitespace-only
  if (!line.trim()) return false;

  // Skip Next.js request logs — brakit already shows these with bodies/headers
  // e.g. " GET /api/user 200 in 189ms (compile: 3ms, proxy.ts: 7ms, render: 179ms)"
  //       "○ GET /dashboard 200 in 45ms"
  if (/^\s*[○●◐]?\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//.test(line)) return false;

  // Always show: ready, error, warning, URL, compilation messages
  const meaningful =
    /ready|error|warn|http:|https:|localhost|compiled|compiling|building|started|listening|hmr|fast refresh|turbopack|webpack/i;
  if (meaningful.test(line)) return true;

  // Skip lines that look like code (common in bundled output)
  if (/^[\s]*[{}\[\]();,]|^var |^function |^const |^let |^import |^export |^class |^\s*\|/.test(line)) return false;

  // Show short informational lines (likely status messages)
  if (line.length < 200) return true;

  return false;
}

function spawnDevServer(
  devBin: string,
  targetPort: number,
  cwd: string,
): ChildProcess {
  return spawn(devBin, ["dev", "--port", String(targetPort)], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(targetPort) },
  });
}
