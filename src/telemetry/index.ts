import { platform, release, arch } from "node:os";
import { spawn } from "node:child_process";
import { VERSION } from "../index.js";
import type { Services } from "../core/services.js";
import { readConfig, getOrCreateConfig, isTelemetryEnabled } from "./config.js";
import {
  POSTHOG_HOST,
  POSTHOG_CAPTURE_PATH,
  POSTHOG_REQUEST_TIMEOUT_MS,
  SPEED_BUCKET_THRESHOLDS,
} from "../constants/labels.js";
import {
  TELEMETRY_EVENT_DASHBOARD_VIEWED,
  TELEMETRY_EVENT_SESSION,
  TELEMETRY_EVENT_GRAPH_FEATURE,
} from "../constants/config.js";

export { isTelemetryEnabled, setTelemetryEnabled } from "./config.js";

const POSTHOG_KEY: string = process.env.POSTHOG_API_KEY ?? "";

// Common properties shared across all events

function commonProperties(): Record<string, unknown> {
  return {
    brakit_version: VERSION,
    node_version: process.version,
    os: `${platform()}-${release()}`,
    arch: arch(),
    $lib: "brakit",
    $process_person_profile: false,
    $geoip_disable: true,
  };
}

// Lightweight event tracking — fire-and-forget via detached child process

function sendToPosthog(
  event: string,
  properties: Record<string, unknown>,
): void {
  if (!isTelemetryEnabled()) return;

  const config = getOrCreateConfig();
  const payload = {
    api_key: POSTHOG_KEY,
    event,
    distinct_id: config.anonymousId,
    timestamp: new Date().toISOString(),
    properties: { ...commonProperties(), ...properties },
  };

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

/**
 * Track a lightweight event. Use for journey milestones (cli_invoked,
 * setup_completed, first_request, dashboard_viewed, cli_uninstall).
 * Never blocks the host app.
 */
export function trackEvent(
  event: string,
  properties: Record<string, unknown>,
): void {
  sendToPosthog(event, { sdk: "node", ...properties });
}

// Session state — accumulated during the session, sent on exit

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
  // Enhanced fields
  frameworkCandidates: string[];
  adaptersFailed: string[];
  setupDurationMs: number;
  setupSucceeded: boolean;
  firstRequestAt: number;
  dashboardOpenedAt: number;
  exitReason: string;
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
  frameworkCandidates: [],
  adaptersFailed: [],
  setupDurationMs: 0,
  setupSucceeded: false,
  firstRequestAt: 0,
  dashboardOpenedAt: 0,
  exitReason: "unknown",
};

export function initSession(
  framework: string,
  packageManager: string,
  isCustomCommand: boolean,
  adapters: string[],
): void {
  getOrCreateConfig();

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
  if (session.dashboardOpened) return; // Only track first open
  session.dashboardOpened = true;
  session.dashboardOpenedAt = Date.now();
  trackEvent(TELEMETRY_EVENT_DASHBOARD_VIEWED, {
    time_to_dashboard_ms:
      session.startTime > 0 ? Date.now() - session.startTime : null,
    request_count_at_open: session.requestCount,
  });
}

export function recordExplainUsed(): void {
  session.explainUsed = true;
}

export function recordGraphFeature(feature: string, detail?: string): void {
  trackEvent(TELEMETRY_EVENT_GRAPH_FEATURE, {
    feature,
    ...(detail ? { detail } : {}),
  });
}

export function recordSetupCompleted(info: {
  frameworkCandidates: string[];
  adaptersFailed: string[];
  setupDurationMs: number;
}): void {
  session.frameworkCandidates = info.frameworkCandidates;
  session.adaptersFailed = info.adaptersFailed;
  session.setupDurationMs = info.setupDurationMs;
  session.setupSucceeded = true;
}

export function recordFirstRequest(): void {
  if (!session.firstRequestAt) session.firstRequestAt = Date.now();
}

export function recordExitReason(reason: string): void {
  if (session.exitReason === "unknown") session.exitReason = reason;
}

// Session event — fired on process exit with full session summary

function speedBucket(ms: number): string {
  if (ms === 0) return "none";
  const t = SPEED_BUCKET_THRESHOLDS;
  if (ms < t[0]) return `<${t[0]}ms`;
  for (let i = 1; i < t.length; i++) {
    if (ms < t[i]) return `${t[i - 1]}-${t[i]}ms`;
  }
  return `>${t[t.length - 1]}ms`;
}

export function trackSession(services: Services): void {
  if (!isTelemetryEnabled()) return;

  const isFirstSession = readConfig() === null;
  const metricsStore = services.metricsStore;
  const analysisEngine = services.analysisEngine;
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

  const now = Date.now();
  sendToPosthog(TELEMETRY_EVENT_SESSION, {
    sdk: "node",
    framework: session.framework,
    package_manager: session.packageManager,
    is_custom_command: session.isCustomCommand,
    first_session: isFirstSession,
    adapters_detected: session.adapters,
    request_count: session.requestCount,
    error_count: services.errorStore.getAll().length,
    query_count: services.queryStore.getAll().length,
    fetch_count: services.fetchStore.getAll().length,
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
    session_duration_s: Math.round((now - session.startTime) / 1000),
    // Enhanced fields
    setup_succeeded: session.setupSucceeded,
    setup_duration_ms: session.setupDurationMs,
    framework_detection_candidates: session.frameworkCandidates,
    adapters_failed: session.adaptersFailed,
    time_to_first_request_ms: session.firstRequestAt
      ? session.firstRequestAt - session.startTime
      : null,
    time_to_dashboard_ms: session.dashboardOpenedAt
      ? session.dashboardOpenedAt - session.startTime
      : null,
    exit_reason: session.exitReason,
  });

  // Ensure config file exists (creates anonymousId if needed)
  getOrCreateConfig();
}
