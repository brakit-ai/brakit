import type { ChildProcess } from "node:child_process";
import pc from "picocolors";
import { DEV_OUTPUT_MAX_LINE_LENGTH } from "../constants.js";

export function shouldShowDevLine(line: string): boolean {
  if (line.length > DEV_OUTPUT_MAX_LINE_LENGTH) return false;
  if (!line.trim()) return false;

  // Skip Next.js request logs — brakit already shows these with more detail
  if (/^\s*[○●◐]?\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//.test(line)) return false;

  const meaningful =
    /ready|error|warn|http:|https:|localhost|compiled|compiling|building|started|listening|hmr|fast refresh|turbopack|webpack/i;
  if (meaningful.test(line)) return true;

  if (/^[\s]*[{}\[\]();,]|^var |^function |^const |^let |^import |^export |^class |^\s*\|/.test(line)) return false;

  if (line.length < 200) return true;

  return false;
}

export function pipeDevOutput(devProcess: ChildProcess): void {
  const handle = (data: Buffer, stream: "stdout" | "stderr") => {
    const text = data.toString().trim();
    if (!text) return;
    for (const line of text.split("\n")) {
      if (shouldShowDevLine(line)) {
        const fn = stream === "stderr" ? console.error : console.log;
        fn(pc.dim(`  [next] ${line.slice(0, 200)}`));
      }
    }
  };
  devProcess.stdout?.on("data", (d: Buffer) => handle(d, "stdout"));
  devProcess.stderr?.on("data", (d: Buffer) => handle(d, "stderr"));
}
