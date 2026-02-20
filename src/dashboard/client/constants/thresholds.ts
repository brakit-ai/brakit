// Analysis thresholds — numeric limits and category maps used by insight engines.
// Values here are either plain numbers (interpolated at build time) or JS source
// fragments (template strings) embedded directly into browser code.

// Health grade thresholds (ms)
export const HEALTH_FAST_MS = 100;
export const HEALTH_GOOD_MS = 300;
export const HEALTH_OK_MS = 800;
export const HEALTH_SLOW_MS = 2000;

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

// Auth/middleware categories to skip in flow analysis
export const AUTH_SKIP_CATEGORIES = `{ 'auth-handshake': 1, 'auth-check': 1, 'middleware': 1 }`;

// Cross-endpoint query detection
export const CROSS_ENDPOINT_MIN_ENDPOINTS = 3;
export const CROSS_ENDPOINT_PCT = 50;
export const CROSS_ENDPOINT_MIN_OCCURRENCES = 5;

// Redundant same-query detection (exact duplicate within one request)
export const REDUNDANT_QUERY_MIN_COUNT = 2;

// Over-fetching detection
export const LARGE_RESPONSE_BYTES = 51_200; // 50KB
export const HIGH_ROW_COUNT = 100;
export const OVERFETCH_MIN_REQUESTS = 2;

// Timeline & performance reload
export const TIMELINE_CACHE_MAX = 50;
export const TIMELINE_ROOT_MARGIN = "'200px'";
export const PERF_RELOAD_DEBOUNCE_MS = 500;
