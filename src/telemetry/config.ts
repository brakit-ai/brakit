import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

export interface TelemetryConfig {
  telemetry: boolean;
  anonymousId: string;
}

const CONFIG_DIR = join(homedir(), ".brakit");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function readConfig(): TelemetryConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as TelemetryConfig;
  } catch {
    return null;
  }
}

export function writeConfig(config: TelemetryConfig): void {
  try {
    if (!existsSync(CONFIG_DIR))
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", {
      mode: 0o600,
    });
  } catch {
    // non-critical
  }
}

export function getOrCreateConfig(): TelemetryConfig {
  const existing = readConfig();
  if (existing && typeof existing.telemetry === "boolean" && existing.anonymousId) {
    return existing;
  }
  const config: TelemetryConfig = { telemetry: true, anonymousId: randomUUID() };
  writeConfig(config);
  return config;
}

export function isTelemetryEnabled(): boolean {
  const env = process.env.BRAKIT_TELEMETRY;
  if (env !== undefined) return env !== "false" && env !== "0" && env !== "off";
  return readConfig()?.telemetry ?? true;
}

export function setTelemetryEnabled(enabled: boolean): void {
  const config = getOrCreateConfig();
  config.telemetry = enabled;
  writeConfig(config);
}
