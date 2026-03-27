/** Constants for the server-side graph builder. */

/** Maximum number of SQL patterns stored per edge to prevent unbounded growth. */
export const MAX_PATTERNS_PER_EDGE = 10;

/** When a path-based cluster exceeds this many endpoints, split into sub-clusters. */
export const CLUSTER_SPLIT_THRESHOLD = 15;

/** URL path prefixes that don't carry semantic grouping value (skipped when computing cluster keys). */
export const COMMON_PATH_PREFIXES = new Set(["api", "v1", "v2", "v3", "v4"]);

/** Maximum pending telemetry entries before forced eviction. */
export const PENDING_BUFFER_MAX = 500;

/** Target size after eviction (oldest entries are dropped first). */
export const PENDING_EVICTION_TARGET = 200;

/** Time-to-live for pending entries — entries older than this are evicted. */
export const PENDING_TTL_MS = 60_000;

export type GroupingStrategy = "path" | "auth-boundary" | "data-domain";
