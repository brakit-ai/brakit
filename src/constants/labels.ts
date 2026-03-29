// ── Routes ──

export const DASHBOARD_PREFIX = "/__brakit";
export const DASHBOARD_API_REQUESTS = `${DASHBOARD_PREFIX}/api/requests` as const;
export const DASHBOARD_API_EVENTS = `${DASHBOARD_PREFIX}/api/events` as const;
export const DASHBOARD_API_FLOWS = `${DASHBOARD_PREFIX}/api/flows` as const;
export const DASHBOARD_API_CLEAR = `${DASHBOARD_PREFIX}/api/clear` as const;
export const DASHBOARD_API_LOGS = `${DASHBOARD_PREFIX}/api/logs` as const;
export const DASHBOARD_API_FETCHES = `${DASHBOARD_PREFIX}/api/fetches` as const;
export const DASHBOARD_API_ERRORS = `${DASHBOARD_PREFIX}/api/errors` as const;
export const DASHBOARD_API_QUERIES = `${DASHBOARD_PREFIX}/api/queries` as const;
export const DASHBOARD_API_INGEST = `${DASHBOARD_PREFIX}/api/ingest` as const;
export const DASHBOARD_API_METRICS = `${DASHBOARD_PREFIX}/api/metrics` as const;
export const DASHBOARD_API_ACTIVITY = `${DASHBOARD_PREFIX}/api/activity` as const;
export const DASHBOARD_API_METRICS_LIVE = `${DASHBOARD_PREFIX}/api/metrics/live` as const;
export const DASHBOARD_API_INSIGHTS = `${DASHBOARD_PREFIX}/api/insights` as const;
export const DASHBOARD_API_SECURITY = `${DASHBOARD_PREFIX}/api/security` as const;
export const DASHBOARD_API_TAB = `${DASHBOARD_PREFIX}/api/tab` as const;
export const DASHBOARD_API_FINDINGS = `${DASHBOARD_PREFIX}/api/findings` as const;
export const DASHBOARD_API_FINDINGS_REPORT = `${DASHBOARD_PREFIX}/api/findings/report` as const;
export const DASHBOARD_API_GRAPH = `${DASHBOARD_PREFIX}/api/graph` as const;

const VALID_TABS_TUPLE = [
  "overview", "actions", "insights", "performance", "graph", "explorer",
] as const;

export type DashboardView = (typeof VALID_TABS_TUPLE)[number];

export const VALID_TABS: Set<DashboardView> = new Set(VALID_TABS_TUPLE);

// ── Headers ──

export const BRAKIT_REQUEST_ID_HEADER = "x-brakit-request-id";
export const BRAKIT_FETCH_ID_HEADER = "x-brakit-fetch-id";

export const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);

// ── HTTP ──

export const HTTP_OK = 200;
export const HTTP_NO_CONTENT = 204;
export const HTTP_BAD_REQUEST = 400;
export const HTTP_NOT_FOUND = 404;
export const HTTP_METHOD_NOT_ALLOWED = 405;
export const HTTP_PAYLOAD_TOO_LARGE = 413;
export const HTTP_INTERNAL_ERROR = 500;

export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data: blob:",
} as const;

// ── Encoding ──

export const CONTENT_ENCODING_GZIP = "gzip" as const;
export const CONTENT_ENCODING_BR = "br" as const;
export const CONTENT_ENCODING_DEFLATE = "deflate" as const;

// ── Severity ──

import type { Severity } from "../types/security.js";

export const SEVERITY_ICON: Record<Severity, string> = {
  critical: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
};

export const SEVERITY_SORT_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// ── Events ──

export const SSE_EVENT_FETCH = "fetch";
export const SSE_EVENT_LOG = "log";
export const SSE_EVENT_ERROR = "error_event";
export const SSE_EVENT_QUERY = "query";
export const SSE_EVENT_ISSUES = "issues";

// ── SDK Events ──

/** SDK event type identifiers received from Python/external SDKs via the ingest API. */

export const SDK_EVENT_REQUEST = "request" as const;
export const SDK_EVENT_DB_QUERY = "db.query" as const;
export const SDK_EVENT_FETCH = "fetch" as const;
export const SDK_EVENT_LOG = "log" as const;
export const SDK_EVENT_ERROR = "error" as const;
export const SDK_EVENT_AUTH_CHECK = "auth.check" as const;

// ── Telemetry ──

export const POSTHOG_HOST = "https://us.i.posthog.com";
export const POSTHOG_CAPTURE_PATH = "/i/v0/e/";
export const POSTHOG_REQUEST_TIMEOUT_MS = 3_000;
export const POSTHOG_SPAWN_TIMEOUT_MS = 5_000;
export const SIGNAL_EXIT_SIGINT = 130;
export const SIGNAL_EXIT_SIGTERM = 143;

/**
 * Thresholds (in ms) for categorizing endpoint response times
 * into human-readable buckets for telemetry reporting.
 */
export const SPEED_BUCKET_THRESHOLDS = [200, 500, 1_000, 2_000, 5_000] as const;

// ── Timeline ──

/** Timeline event type identifiers used in activity API and dashboard rendering. */

export const TIMELINE_FETCH = "fetch" as const;
export const TIMELINE_LOG = "log" as const;
export const TIMELINE_ERROR = "error" as const;
export const TIMELINE_QUERY = "query" as const;
