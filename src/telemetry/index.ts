import { platform, release, arch } from "node:os";
import { VERSION } from "../index.js";
import type { AnalysisEngine } from "../analysis/engine.js";
import type { MetricsStore } from "../store/index.js";
import {
  defaultQueryStore,
  defaultFetchStore,
  defaultErrorStore,
} from "../store/index.js";
import { readConfig, getOrCreateConfig, isTelemetryEnabled } from "./config.js";

export { isTelemetryEnabled, setTelemetryEnabled } from "./config.js";

const POSTHOG_HOST = "https://app.posthog.com";
const POSTHOG_KEY = "phc_gH8aQFZ2Fn8db9LEdgomOvymLiP6mm6FPTYXffQceR8";

let startTime = 0;
let sessionFramework = "";
let sessionPackageManager = "";
let sessionIsCustomCommand = false;
let sessionAdapters: string[] = [];
let requestCount = 0;
const insightTypes = new Set<string>();
const rulesTriggered = new Set<string>();
const tabsViewed = new Set<string>();
let dashboardOpened = false;
let explainUsed = false;

export function initSession(
  framework: string,
  packageManager: string,
  isCustomCommand: boolean,
  adapters: string[],
): void {
  startTime = Date.now();
  sessionFramework = framework;
  sessionPackageManager = packageManager;
  sessionIsCustomCommand = isCustomCommand;
  sessionAdapters = adapters;
}

export function recordRequestCount(count: number): void {
  requestCount = count;
}

export function recordInsightTypes(types: string[]): void {
  for (const t of types) insightTypes.add(t);
}

export function recordRulesTriggered(rules: string[]): void {
  for (const r of rules) rulesTriggered.add(r);
}

export function recordTabViewed(tab: string): void {
  tabsViewed.add(tab);
}

export function recordDashboardOpened(): void {
  dashboardOpened = true;
}

export function recordExplainUsed(): void {
  explainUsed = true;
}

function speedBucket(ms: number): string {
  if (ms === 0) return "none";
  if (ms < 200) return "<200ms";
  if (ms < 500) return "200-500ms";
  if (ms < 1000) return "500-1000ms";
  if (ms < 2000) return "1000-2000ms";
  if (ms < 5000) return "2000-5000ms";
  return ">5000ms";
}

export function trackSession(
  metricsStore: MetricsStore,
  analysisEngine: AnalysisEngine,
): void {
  if (!isTelemetryEnabled()) return;

  const isFirstSession = readConfig() === null;
  const config = getOrCreateConfig();
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
      framework: sessionFramework,
      package_manager: sessionPackageManager,
      is_custom_command: sessionIsCustomCommand,
      first_session: isFirstSession,
      adapters_detected: sessionAdapters,
      request_count: requestCount,
      error_count: defaultErrorStore.getAll().length,
      query_count: defaultQueryStore.getAll().length,
      fetch_count: defaultFetchStore.getAll().length,
      insight_count: insights.length,
      finding_count: findings.length,
      insight_types: [...insightTypes],
      rules_triggered: [...rulesTriggered],
      endpoint_count: live.length,
      avg_duration_ms:
        totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0,
      slowest_endpoint_bucket: speedBucket(slowestP95),
      tabs_viewed: [...tabsViewed],
      dashboard_opened: dashboardOpened,
      explain_used: explainUsed,
      session_duration_s: Math.round((Date.now() - startTime) / 1000),
      $lib: "brakit",
      $ip: null,
      $geoip_disable: true,
    },
  };

  fetch(`${POSTHOG_HOST}/capture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
