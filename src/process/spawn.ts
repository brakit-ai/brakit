import { spawn, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getPreloadUrl(): string {
  const preloadPath = resolve(__dirname, "../instrument/preload.js");
  return pathToFileURL(preloadPath).href;
}

function getNodeOptions(): string {
  const preloadUrl = getPreloadUrl();
  const existing = process.env.NODE_OPTIONS ?? "";
  return `--import ${preloadUrl} ${existing}`.trim();
}

export function spawnDevServer(
  devBin: string,
  targetPort: number,
  proxyPort: number,
  cwd: string,
): ChildProcess {
  return spawn(
    process.execPath,
    [devBin, "dev", "--port", String(targetPort)],
    {
      cwd,
      stdio: ["ignore", "inherit", "inherit"],
      env: {
        ...process.env,
        PORT: String(targetPort),
        BRAKIT_PORT: String(proxyPort),
        NODE_OPTIONS: getNodeOptions(),
      },
    },
  );
}

/**
 * Spawn an arbitrary user-provided command. NODE_OPTIONS with --import
 * is only injected for Node.js processes (harmless for non-Node since
 * the env var is ignored by other runtimes).
 */
export function spawnCustomCommand(
  command: string,
  targetPort: number,
  proxyPort: number,
  cwd: string,
): ChildProcess {
  const [cmd, ...args] = command.split(/\s+/);
  return spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
      PORT: String(targetPort),
      BRAKIT_PORT: String(proxyPort),
      NODE_OPTIONS: getNodeOptions(),
    },
  });
}
