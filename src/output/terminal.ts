import pc from "picocolors";
import type { TracedRequest } from "../types.js";
import { VERSION } from "../index.js";
import { DASHBOARD_PREFIX } from "../constants.js";

function statusColor(code: number): (s: string) => string {
  if (code >= 500) return pc.red;
  if (code >= 400) return pc.yellow;
  if (code >= 300) return pc.cyan;
  if (code >= 200) return pc.green;
  return pc.white;
}

function methodColor(method: string): (s: string) => string {
  switch (method) {
    case "GET":
      return pc.green;
    case "POST":
      return pc.blue;
    case "PUT":
    case "PATCH":
      return pc.yellow;
    case "DELETE":
      return pc.red;
    default:
      return pc.white;
  }
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes}b`;
  return `${(bytes / 1024).toFixed(1)}kb`;
}

export function formatRequest(req: TracedRequest): string {
  const status = statusColor(req.statusCode)(String(req.statusCode));
  const method = methodColor(req.method)(req.method.padEnd(7));
  const duration = pc.dim(`${req.durationMs}ms`);
  const size =
    req.responseSize > 0 ? pc.dim(`(${formatSize(req.responseSize)})`) : "";

  return `  ${method} ${req.path} ${status} ${duration} ${size}`;
}

export function printBanner(proxyPort: number, targetPort: number): void {
  console.log();
  console.log(`  ${pc.bold(pc.magenta("brakit"))} ${pc.dim(`v${VERSION}`)}`);
  console.log();
  console.log(
    `  ${pc.dim("proxy")}    ${pc.bold(`http://localhost:${proxyPort}`)}`,
  );
  console.log(
    `  ${pc.dim("target")}   ${pc.dim(`http://localhost:${targetPort}`)}`,
  );
  console.log(
    `  ${pc.dim("inspect")}  ${pc.bold(pc.magenta(`http://localhost:${proxyPort}${DASHBOARD_PREFIX}`))}`,
  );
  console.log();
  console.log(`  ${pc.dim("Waiting for requests...")}`);
  console.log();
}
