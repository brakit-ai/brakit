import { spawn, type ChildProcess } from "node:child_process";

export function spawnDevServer(
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
