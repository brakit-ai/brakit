import { homedir, platform } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DIR_MODE_OWNER_ONLY, FILE_MODE_OWNER_ONLY } from "../constants/features.js";

const IS_WINDOWS = platform() === "win32";

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
      mkdirSync(CONFIG_DIR, { recursive: true, ...(IS_WINDOWS ? {} : { mode: DIR_MODE_OWNER_ONLY }) });
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify(config, null, 2) + "\n",
      IS_WINDOWS ? {} : { mode: FILE_MODE_OWNER_ONLY },
    );
  } catch (err) {
    // Log at debug level so Windows/permission issues are diagnosable
    if (process.env.BRAKIT_DEBUG) {
      process.stderr.write(`[brakit] config write failed: ${(err as Error)?.message ?? err}\n`);
    }
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

let cachedEnabled: boolean | null = null;

export function isTelemetryEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled;
  const env = process.env.BRAKIT_TELEMETRY;
  if (env !== undefined) {
    cachedEnabled = env !== "false" && env !== "0" && env !== "off";
    return cachedEnabled;
  }
  cachedEnabled = readConfig()?.telemetry ?? true;
  return cachedEnabled;
}

export function setTelemetryEnabled(enabled: boolean): void {
  const config = getOrCreateConfig();
  config.telemetry = enabled;
  writeConfig(config);
  cachedEnabled = enabled;
}
