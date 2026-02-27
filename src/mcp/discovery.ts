/**
 * Port discovery for the MCP server.
 *
 * When brakit instruments an app, it writes the dashboard port to `.brakit/port`.
 * The MCP server reads this file to discover where to send API requests.
 * `waitForBrakit` polls until the port file appears and the dashboard responds.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PORT_FILE, DASHBOARD_API_REQUESTS } from "../constants/index.js";
import { DISCOVERY_POLL_INTERVAL_MS } from "../constants/mcp.js";

export interface DiscoveryResult {
  port: number;
  baseUrl: string;
}

export function discoverBrakitPort(cwd?: string): DiscoveryResult {
  const root = cwd ?? process.cwd();
  const portPath = resolve(root, PORT_FILE);

  if (!existsSync(portPath)) {
    throw new Error(
      `Brakit is not running. No port file found at ${portPath}.\n` +
      `Start your app with brakit enabled first.`,
    );
  }

  const raw = readFileSync(portPath, "utf-8").trim();
  const port = parseInt(raw, 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port in ${portPath}: "${raw}"`);
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
    } catch {
      // Discovery poll — brakit may not be ready yet
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    "Timed out waiting for Brakit to start. Is your app running with brakit enabled?",
  );
}
