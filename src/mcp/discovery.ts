import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { PORT_FILE, DASHBOARD_API_REQUESTS } from "../constants/index.js";
import { brakitDebug } from "../utils/log.js";
import {
  DISCOVERY_POLL_INTERVAL_MS,
  MAX_DISCOVERY_DEPTH,
} from "../constants/mcp.js";

export interface DiscoveryResult {
  port: number;
  baseUrl: string;
}

function readPort(portPath: string): number | null {
  if (!existsSync(portPath)) return null;
  const raw = readFileSync(portPath, "utf-8").trim();
  const port = parseInt(raw, 10);
  return isNaN(port) || port < 1 || port > 65535 ? null : port;
}

function portInDir(dir: string): number | null {
  return readPort(resolve(dir, PORT_FILE));
}

function portInChildren(dir: string): number | null {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const child = resolve(dir, entry);
      try {
        if (!statSync(child).isDirectory()) continue;
      } catch (err) {
        brakitDebug(`discovery: stat failed for ${child}: ${err}`);
        continue;
      }
      const port = portInDir(child);
      if (port) return port;
    }
  } catch (err) {
    brakitDebug(`discovery: readdir failed for ${dir}: ${err}`);
  }
  return null;
}

function searchForPort(startDir: string): number | null {
  const start = resolve(startDir);

  // Check cwd and its immediate children (handles monorepo root pointing to a sub-project)
  const initial = portInDir(start) ?? portInChildren(start);
  if (initial) return initial;

  // Walk up and check children at each level (handles parent-of-project case)
  let dir = dirname(start);
  for (let depth = 0; depth < MAX_DISCOVERY_DEPTH; depth++) {
    const port = portInDir(dir) ?? portInChildren(dir);
    if (port) return port;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export function discoverBrakitPort(cwd?: string): DiscoveryResult {
  const port = searchForPort(cwd ?? process.cwd());

  if (!port) {
    throw new Error(
      "Brakit is not running. Start your app with brakit enabled first.",
    );
  }

  return { port, baseUrl: `http://localhost:${port}` };
}

export async function waitForBrakit(
  cwd?: string,
  timeoutMs = 10_000,
  pollMs = DISCOVERY_POLL_INTERVAL_MS,
): Promise<DiscoveryResult> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const result = discoverBrakitPort(cwd);
      const res = await fetch(`${result.baseUrl}${DASHBOARD_API_REQUESTS}?limit=1`);
      if (res.ok) return result;
    } catch {}
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    "Timed out waiting for Brakit to start. Is your app running with brakit enabled?",
  );
}
