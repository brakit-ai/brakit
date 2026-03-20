import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { PORT_FILE, DASHBOARD_API_REQUESTS, PORT_MIN, PORT_MAX } from "../constants/index.js";
import { brakitDebug } from "../utils/log.js";
import {
  DISCOVERY_POLL_INTERVAL_MS,
  MAX_DISCOVERY_DEPTH,
} from "../constants/features.js";

export interface DiscoveryResult {
  port: number;
  baseUrl: string;
}

async function readPort(portPath: string): Promise<number | null> {
  try {
    const raw = (await readFile(portPath, "utf-8")).trim();
    const port = parseInt(raw, 10);
    return isNaN(port) || port < PORT_MIN || port > PORT_MAX ? null : port;
  } catch {
    return null;
  }
}

async function portInDir(dir: string): Promise<number | null> {
  return readPort(resolve(dir, PORT_FILE));
}

async function portInChildren(dir: string): Promise<number | null> {
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const child = resolve(dir, entry);
      try {
        if (!(await stat(child)).isDirectory()) continue;
      } catch (err) {
        brakitDebug(`discovery: stat failed for ${child}: ${err}`);
        continue;
      }
      const port = await portInDir(child);
      if (port) return port;
    }
  } catch (err) {
    brakitDebug(`discovery: readdir failed for ${dir}: ${err}`);
  }
  return null;
}

async function searchForPort(startDir: string): Promise<number | null> {
  const start = resolve(startDir);

  // Check cwd and its immediate children (handles monorepo root pointing to a sub-project)
  const initial = (await portInDir(start)) ?? (await portInChildren(start));
  if (initial) return initial;

  // Walk up and check children at each level (handles parent-of-project case)
  let dir = dirname(start);
  for (let depth = 0; depth < MAX_DISCOVERY_DEPTH; depth++) {
    const port = (await portInDir(dir)) ?? (await portInChildren(dir));
    if (port) return port;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export async function discoverBrakitPort(cwd?: string): Promise<DiscoveryResult> {
  const port = await searchForPort(cwd ?? process.cwd());

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
      const result = await discoverBrakitPort(cwd);
      const res = await fetch(`${result.baseUrl}${DASHBOARD_API_REQUESTS}?limit=1`);
      if (res.ok) return result;
    } catch {}
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    "Timed out waiting for Brakit to start. Is your app running with brakit enabled?",
  );
}
