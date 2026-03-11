import { platform, release, arch } from "node:os";
import { spawn } from "node:child_process";
import { VERSION } from "../index.js";
import type { ServiceRegistry } from "../core/service-registry.js";
import { readConfig, getOrCreateConfig, isTelemetryEnabled } from "./config.js";
import {
  POSTHOG_HOST,
  POSTHOG_CAPTURE_PATH,
  POSTHOG_REQUEST_TIMEOUT_MS,
  SPEED_BUCKET_THRESHOLDS,
} from "../constants/telemetry.js";

export { isTelemetryEnabled, setTelemetryEnabled } from "./config.js";

const POSTHOG_KEY: string = process.env.POSTHOG_API_KEY ?? "";

interface SessionState {
  startTime: number;
  framework: string;
  packageManager: string;
  isCustomCommand: boolean;
  adapters: string[];
  requestCount: number;
  insightTypes: Set<string>;
  rulesTriggered: Set<string>;
  tabsViewed: Set<string>;
  dashboardOpened: boolean;
  explainUsed: boolean;
}

const session: SessionState = {
  startTime: 0,
  framework: "",
  packageManager: "",
  isCustomCommand: false,
  adapters: [],
  requestCount: 0,
  insightTypes: new Set(),
  rulesTriggered: new Set(),
  tabsViewed: new Set(),
  dashboardOpened: false,
  explainUsed: false,
};

export function initSession(
  framework: string,
  packageManager: string,
  isCustomCommand: boolean,
  adapters: string[],
): void {
  session.startTime = Date.now();
  session.framework = framework;
  session.packageManager = packageManager;
  session.isCustomCommand = isCustomCommand;
  session.adapters = adapters;
}

export function recordRequestCount(count: number): void {
  session.requestCount = count;
}

export function recordInsightTypes(types: string[]): void {
  for (const t of types) session.insightTypes.add(t);
}

export function recordRulesTriggered(rules: string[]): void {
  for (const r of rules) session.rulesTriggered.add(r);
}

export function recordTabViewed(tab: string): void {
  session.tabsViewed.add(tab);
}

export function recordDashboardOpened(): void {
  session.dashboardOpened = true;
}

export function recordExplainUsed(): void {
  session.explainUsed = true;
}

function speedBucket(ms: number): string {
  if (ms === 0) return "none";
  const t = SPEED_BUCKET_THRESHOLDS;
  if (ms < t[0]) return `<${t[0]}ms`;
  for (let i = 1; i < t.length; i++) {
    if (ms < t[i]) return `${t[i - 1]}-${t[i]}ms`;
  }
  return `>${t[t.length - 1]}ms`;
}

export function trackSession(registry: ServiceRegistry): void {
  if (!isTelemetryEnabled()) return;

  const isFirstSession = readConfig() === null;
  const config = getOrCreateConfig();
  const metricsStore = registry.get("metrics-store");
  const analysisEngine = registry.get("analysis-engine");
  const live = metricsStore.getLiveEndpoints();
  const insights = analysisEngine.getInsights();
  const findings = analysisEngine.getFindings();

  let totalRequests = 0;
  let totalDuration = 0;
  let slowestP95 = 0;

  for (const ep of live) {
    totalRequests += ep.summary.totalRequests;
    totalDuration += ep.summary.p95Ms * ep.summary.totalRequests;
    if (ep.summary.p95Ms > slowestP95) slowestP95 = ep.summary.p95Ms;
  }

  const payload = {
    api_key: POSTHOG_KEY,
    event: "session",
    distinct_id: config.anonymousId,
    timestamp: new Date().toISOString(),
    properties: {
      brakit_version: VERSION,
      node_version: process.version,
      os: `${platform()}-${release()}`,
      arch: arch(),
      framework: session.framework,
      package_manager: session.packageManager,
      is_custom_command: session.isCustomCommand,
      first_session: isFirstSession,
      adapters_detected: session.adapters,
      request_count: session.requestCount,
      error_count: registry.get("error-store").getAll().length,
      query_count: registry.get("query-store").getAll().length,
      fetch_count: registry.get("fetch-store").getAll().length,
      insight_count: insights.length,
      finding_count: findings.length,
      insight_types: [...session.insightTypes],
      rules_triggered: [...session.rulesTriggered],
      endpoint_count: live.length,
      avg_duration_ms:
        totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0,
      slowest_endpoint_bucket: speedBucket(slowestP95),
      tabs_viewed: [...session.tabsViewed],
      dashboard_opened: session.dashboardOpened,
      explain_used: session.explainUsed,
      session_duration_s: Math.round((Date.now() - session.startTime) / 1000),
      $lib: "brakit",
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };

  // Fire-and-forget via detached child process — never blocks the host app.
  try {
    const body = JSON.stringify(payload);
    const url = `${POSTHOG_HOST}${POSTHOG_CAPTURE_PATH}`;
    const child = spawn(
      process.execPath,
      [
        "-e",
        `fetch(${JSON.stringify(url)},{method:"POST",headers:{"content-type":"application/json"},body:${JSON.stringify(body)},signal:AbortSignal.timeout(${POSTHOG_REQUEST_TIMEOUT_MS})}).catch(()=>{})`,
      ],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
  } catch {
    /* non-critical */
  }
}
