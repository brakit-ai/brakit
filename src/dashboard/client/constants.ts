// Client-side display constants — embedded into browser JS via template strings.
// Values here are JS source fragments (strings/numbers) interpolated at build time.

// Color maps for telemetry displays
export const QUERY_OP_COLORS = `{ SELECT: 'var(--blue)', INSERT: '#22c55e', UPDATE: '#f59e0b', DELETE: 'var(--red)', COUNT: 'var(--dim)' }`;

export const LOG_LEVEL_COLORS = `{ error: 'var(--red)', warn: '#f59e0b', info: 'var(--blue)', debug: 'var(--dim)', log: 'var(--fg)' }`;

export const GRAPH_COLORS = `['#60a5fa','#a855f7','#4ade80','#fbbf24','#f87171','#22d3ee','#fb923c','#e879f9','#34d399','#f472b6']`;

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
