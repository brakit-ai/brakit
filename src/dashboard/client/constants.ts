/**
 * Dashboard client constants — barrel re-export of all sub-modules plus
 * display-only constants (colors, chart config, severity, HTTP status).
 */

export {
  API_PREFIX,
  DASHBOARD_PREFIX,
  API,
} from "./constants/api.js";

export {
  AUTH_SKIP_CATEGORIES,
  CATEGORY_POLLING,
  CATEGORY_STATIC,
} from "./constants/categories.js";

export {
  SSE_EVENT_FETCH,
  SSE_EVENT_LOG,
  SSE_EVENT_ERROR,
  SSE_EVENT_QUERY,
  SSE_EVENT_ISSUES,
} from "./constants/events.js";

export {
  VIEW_TITLES,
  VIEW_SUBTITLES,
  EXPLORER_TABS,
  type ExplorerTab,
} from "./constants/navigation.js";

export {
  SECURITY_RULES,
  PERFORMANCE_RULES,
  categorizeIssue,
  type IssueCategory,
} from "./constants/rules.js";

export { UI_STRINGS } from "./constants/ui-strings.js";

import {
  HEALTH_FAST_MS,
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  HEALTH_SLOW_MS,
} from "./constants/thresholds.js";

export {
  HEALTH_FAST_MS,
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  HEALTH_SLOW_MS,
  SLOW_QUERY_THRESHOLD_MS,
  TIMELINE_CACHE_MAX,
  PERF_RELOAD_DEBOUNCE_MS,
  HIGH_QUERY_COUNT_PER_REQ,
  LARGE_RESPONSE_BYTES,
  SLOW_REQUEST_THRESHOLD_MS,
  CLEAN_HITS_FOR_RESOLUTION,
} from "./constants/thresholds.js";

export {
  CLIENT_MAX_REQUESTS,
  CLIENT_RELOAD_DEBOUNCE_MS,
  CLIENT_TOAST_DURATION_MS,
  CLIENT_SENSITIVE_MASK_THRESHOLD,
  SSE_RECONNECT_BASE_MS,
  SSE_RECONNECT_MAX_MS,
  SSE_MAX_RETRIES,
} from "./constants/runtime.js";

export {
  WF_LABEL_WIDTH_PX,
  WF_DUR_WIDTH_PX,
  WF_TICK_COUNT,
} from "./constants/layout.js";

// ---------------------------------------------------------------------------
// Display constants — kept inline since they're purely visual config.
// ---------------------------------------------------------------------------

export const ALL_ENDPOINTS_SELECTOR = "__all__";

import type { NormalizedOp, LogLevel, Severity } from "./store/types.js";

const QUERY_OP_COLOR_MAP: Record<NormalizedOp, string> = {
  SELECT: "var(--blue)",
  INSERT: "var(--green)",
  UPDATE: "var(--amber)",
  DELETE: "var(--red)",
  OTHER: "var(--text-muted)",
};

/** Safe lookup with fallback for unknown operation strings from the API. */
export const QUERY_OP_COLORS: Record<string, string> = QUERY_OP_COLOR_MAP;

const LOG_LEVEL_COLOR_MAP: Record<LogLevel, string> = {
  error: "var(--red)",
  warn: "var(--amber)",
  info: "var(--blue)",
  debug: "var(--text-muted)",
  log: "var(--text-dim)",
};

export const LOG_LEVEL_COLORS: Record<string, string> = LOG_LEVEL_COLOR_MAP;

export const GRAPH_COLORS = [
  "#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626",
  "#0891b2", "#ea580c", "#c026d3", "#059669", "#db2777",
] as const;

/** Canvas dot colors — CSS variables don't work on canvas, so hex is required. */
export const DOT_COLORS: Record<string, string> = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#f87171",
};

export interface HealthGrade {
  max: number;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const HEALTH_GRADES: HealthGrade[] = [
  { max: HEALTH_FAST_MS, label: "Fast", color: "var(--green)", bg: "var(--green-bg)", border: "var(--green-border)" },
  { max: HEALTH_GOOD_MS, label: "Good", color: "var(--green)", bg: "var(--green-bg-subtle)", border: "var(--green-border-subtle)" },
  { max: HEALTH_OK_MS, label: "OK", color: "var(--amber)", bg: "var(--amber-bg)", border: "var(--amber-border)" },
  { max: HEALTH_SLOW_MS, label: "Slow", color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-border)" },
  { max: Infinity, label: "Critical", color: "var(--red)", bg: "var(--red-bg)", border: "var(--red-border)" },
];

export const CHART_GRID_COLOR = "rgba(228,228,231,0.8)";
export const CHART_LABEL_COLOR = "rgba(113,113,122,0.7)";
export const CHART_FONT = "10px monospace";
export const CHART_FONT_SM = "9px monospace";
export const CHART_FONT_XS = "8px monospace";
export const CHART_PAD = { top: 16, right: 16, bottom: 28, left: 52 } as const;

export const TL_TYPE_COLORS: Record<string, string> = {
  fetch: "var(--blue)",
  log: "var(--text-muted)",
  error: "var(--red)",
  query: "var(--accent)",
};

export const TL_TYPE_LABELS: Record<string, string> = {
  fetch: "FETCH",
  log: "LOG",
  error: "ERROR",
  query: "QUERY",
};

export const SENSITIVE_HEADERS = new Set([
  "cookie", "set-cookie", "authorization",
  "proxy-authorization", "x-api-key", "x-auth-token",
]);

export const HTTP_STATUS_MAP: Record<number, string> = {
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
  404: "Not Found", 405: "Method Not Allowed", 408: "Timeout",
  409: "Conflict", 422: "Unprocessable", 429: "Too Many Requests",
  500: "Internal Server Error", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout",
};

export const CURL_SKIP_HEADERS = new Set(["host", "connection", "accept-encoding"]);

export const SEVERITY_MAP: Record<Severity, { icon: string; cls: string; sort: number }> = {
  critical: { icon: "\u2717", cls: "critical", sort: 0 },
  warning: { icon: "\u26A0", cls: "warning", sort: 1 },
  info: { icon: "\u2139", cls: "info", sort: 2 },
};
