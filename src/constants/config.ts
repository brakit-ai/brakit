// ── Limits ──

export const MAX_REQUEST_ENTRIES = 1_000;
export const DEFAULT_MAX_BODY_CAPTURE = 10_240;
export const DEFAULT_API_LIMIT = 500;
export const MAX_TELEMETRY_ENTRIES = 1_000;
export const MAX_TAB_NAME_LENGTH = 32;
export const MAX_INGEST_BYTES = 10_485_760;
export const TERMINAL_TRUNCATE_LENGTH = 80;
export const SENSITIVE_MASK_MIN_LENGTH = 8;
export const SENSITIVE_MASK_VISIBLE_CHARS = 4;
export const MAX_JSON_BODY_BYTES = 65_536;
export const ANALYSIS_DEBOUNCE_MS = 300;
export const ISSUE_ID_HASH_LENGTH = 16;
export const ISSUES_DATA_VERSION = 2;
export const SENSITIVE_MASK_PLACEHOLDER = "****";

/** Length of the hex prefix used to hash project paths for data directories. */
export const PROJECT_HASH_LENGTH = 8;

/** Maximum array elements to scan in the exposed-secret rule. */
export const SECRET_SCAN_ARRAY_LIMIT = 5;

/** Maximum array elements to scan in PII detection (email/list traversal). */
export const PII_SCAN_ARRAY_LIMIT = 10;

/** Minimum string length to consider a value as a potential secret. */
export const MIN_SECRET_VALUE_LENGTH = 8;

/**
 * A response with this many top-level fields likely represents a full database
 * record (e.g. user profile) rather than a simple acknowledgment.
 */
export const FULL_RECORD_MIN_FIELDS = 8;

/** Minimum items in a list endpoint that must contain PII to flag. */
export const LIST_PII_MIN_ITEMS = 2;

/** Hard ceiling for the `limit` query parameter on API endpoints. */
export const MAX_API_LIMIT = 500;

/** Maximum nesting depth for recursive object traversal in security rules. */
export const MAX_OBJECT_SCAN_DEPTH = 5;

/** Maximum unique endpoints tracked by MetricsStore before refusing new entries. */
export const MAX_UNIQUE_ENDPOINTS = 500;

/** Maximum entries per accumulator array between flush intervals. */
export const MAX_ACCUMULATOR_ENTRIES = 1_000;

/** TTL in ms before resolved/stale issues are pruned from IssueStore. */
export const ISSUE_PRUNE_TTL_MS = 10 * 60 * 1_000;

// ── Thresholds ──

export const FLOW_GAP_MS = 5_000;
export const SLOW_REQUEST_THRESHOLD_MS = 2_000;
export const MIN_POLLING_SEQUENCE = 3;
export const ENDPOINT_TRUNCATE_LENGTH = 12;
export const SHUTDOWN_TIMEOUT_MS = 3_000;
export const N1_QUERY_THRESHOLD = 5;
export const ERROR_RATE_THRESHOLD_PCT = 20;
export const SLOW_ENDPOINT_THRESHOLD_MS = 1_000;
export const MIN_REQUESTS_FOR_INSIGHT = 2;
export const HIGH_QUERY_COUNT_PER_REQ = 5;
export const CROSS_ENDPOINT_MIN_ENDPOINTS = 3;
export const CROSS_ENDPOINT_PCT = 50;
export const CROSS_ENDPOINT_MIN_OCCURRENCES = 5;
export const REDUNDANT_QUERY_MIN_COUNT = 2;
export const LARGE_RESPONSE_BYTES = 51_200;
export const HIGH_ROW_COUNT = 100;
export const OVERFETCH_MIN_REQUESTS = 2;
export const OVERFETCH_MIN_FIELDS = 8;
export const OVERFETCH_MIN_INTERNAL_IDS = 2;
export const OVERFETCH_NULL_RATIO = 0.3;
export const REGRESSION_PCT_THRESHOLD = 50;
export const REGRESSION_MIN_INCREASE_MS = 200;
export const REGRESSION_MIN_REQUESTS = 5;
export const QUERY_COUNT_REGRESSION_RATIO = 1.5;
export const OVERFETCH_MANY_FIELDS = 12;
export const OVERFETCH_UNWRAP_MIN_SIZE = 3;
export const MAX_DUPLICATE_INSIGHTS = 3;
export const INSIGHT_WINDOW_PER_ENDPOINT = 20;
export const CLEAN_HITS_FOR_RESOLUTION = 5;
export const STALE_ISSUE_TTL_MS = 30 * 60 * 1_000;
/**
 * Maximum gap between paired requests for React Strict Mode detection.
 * Set to 2s to accommodate Next.js App Router where hydration + strict mode
 * remount (mount → unmount → remount) can take longer than expected.
 */
export const STRICT_MODE_MAX_GAP_MS = 2000;

// ── Metrics ──

export const METRICS_DIR = ".brakit";
export const METRICS_FILE = "metrics.json";
export const PORT_FILE = ".brakit/port";
export const ISSUES_FILE = "issues.json";
export const METRICS_FLUSH_INTERVAL_MS = 30_000;
export const METRICS_MAX_SESSIONS = 50;
export const METRICS_MAX_DATA_POINTS = 200;
export const ISSUES_FLUSH_INTERVAL_MS = 10_000;

// ── Transport ──

export const TRANSPORT_FLUSH_INTERVAL_MS = 50;
export const TRANSPORT_FLUSH_BATCH_SIZE = 20;
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
export const NOISE_HOSTS = ["registry.npmjs.org", "telemetry.nextjs.org", "vitejs.dev"] as const;
export const NOISE_PATH_PATTERNS = [".hot-update.", "__webpack", "__vite"] as const;

// ── Lifecycle ──

import type { IssueState, IssueCategory, AiFixStatus } from "../types/issue-lifecycle.js";
import type { SecuritySeverity } from "../types/security.js";

export const VALID_ISSUE_STATES = new Set<IssueState>(["open", "fixing", "resolved", "stale", "regressed"]);
export const VALID_ISSUE_CATEGORIES = new Set<IssueCategory>(["security", "performance", "reliability"]);
export const VALID_AI_FIX_STATUSES = new Set<AiFixStatus>(["fixed", "wont_fix"]);
export const VALID_SECURITY_SEVERITIES = new Set<SecuritySeverity>(["critical", "warning"]);
