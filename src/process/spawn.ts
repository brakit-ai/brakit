import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function spawnDevServer(
  devBin: string,
  targetPort: number,
  proxyPort: number,
  cwd: string,
): ChildProcess {
  const preloadPath = resolve(__dirname, "../instrument/preload.js");
  const preloadUrl = pathToFileURL(preloadPath).href;

  // NODE_OPTIONS applies --import to both the main process AND
  // Turbopack worker processes where server-side code actually runs.
  const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
  const nodeOptions =
    `--import ${preloadUrl} ${existingNodeOptions}`.trim();

  return spawn(
    process.execPath,
    [devBin, "dev", "--port", String(targetPort)],
    {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(targetPort),
        BRAKIT_PORT: String(proxyPort),
        NODE_OPTIONS: nodeOptions,
      },
    },
  );
}
