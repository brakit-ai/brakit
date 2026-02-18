// Client-side display constants — embedded into browser JS via template strings.
// Values here are JS source fragments (strings/numbers) interpolated at build time.

// Color maps for telemetry displays
export const QUERY_OP_COLORS = `{ SELECT: 'var(--blue)', INSERT: 'var(--green)', UPDATE: 'var(--amber)', DELETE: 'var(--red)', COUNT: 'var(--text-muted)' }`;

export const LOG_LEVEL_COLORS = `{ error: 'var(--red)', warn: 'var(--amber)', info: 'var(--blue)', debug: 'var(--text-muted)', log: 'var(--text-dim)' }`;

export const GRAPH_COLORS = `['#2563eb','#7c3aed','#16a34a','#d97706','#dc2626','#0891b2','#ea580c','#c026d3','#059669','#db2777']`;

// Health grade thresholds (ms)
export const HEALTH_FAST_MS = 100;
export const HEALTH_GOOD_MS = 300;
export const HEALTH_OK_MS = 800;
export const HEALTH_SLOW_MS = 2000;

// Trend detection — below these thresholds, performance is considered "stable"
export const TREND_STABLE_PCT = 15;
export const TREND_STABLE_ABS_MS = 150;

// Query display thresholds
export const SLOW_QUERY_THRESHOLD_MS = 100;
export const HIGH_QUERY_COUNT_PER_REQ = 5;

// Overview insight thresholds
export const N1_QUERY_THRESHOLD = 5;
export const ERROR_RATE_THRESHOLD_PCT = 20;
export const SLOW_ENDPOINT_THRESHOLD_MS = 1000;
export const MIN_REQUESTS_FOR_INSIGHT = 2;

// Auth overhead detection
export const AUTH_OVERHEAD_PCT = 30;
export const AUTH_SLOW_MS = 500;

// Over-fetching detection
export const LARGE_RESPONSE_BYTES = 51_200; // 50KB
export const HIGH_ROW_COUNT = 100;
export const OVERFETCH_MIN_REQUESTS = 2;
