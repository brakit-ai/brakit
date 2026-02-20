// Client-only display thresholds. Shared insight thresholds live in
// src/constants/thresholds.ts and are re-exported here for client templates.

// Health grade thresholds (ms)
export const HEALTH_FAST_MS = 100;
export const HEALTH_GOOD_MS = 300;
export const HEALTH_OK_MS = 800;
export const HEALTH_SLOW_MS = 2000;

// Query display thresholds
export const SLOW_QUERY_THRESHOLD_MS = 100;

// Auth display
export const AUTH_SLOW_MS = 500;

// Auth/middleware categories (JS source fragment for client-side template)
export const AUTH_SKIP_CATEGORIES = `{ 'auth-handshake': 1, 'auth-check': 1, 'middleware': 1 }`;

// Timeline & performance reload
export const TIMELINE_CACHE_MAX = 50;
export const TIMELINE_ROOT_MARGIN = "'200px'";
export const PERF_RELOAD_DEBOUNCE_MS = 500;

// Re-export shared thresholds so existing client templates keep working
export {
  N1_QUERY_THRESHOLD,
  ERROR_RATE_THRESHOLD_PCT,
  SLOW_ENDPOINT_THRESHOLD_MS,
  MIN_REQUESTS_FOR_INSIGHT,
  HIGH_QUERY_COUNT_PER_REQ,
  AUTH_OVERHEAD_PCT,
  CROSS_ENDPOINT_MIN_ENDPOINTS,
  CROSS_ENDPOINT_PCT,
  CROSS_ENDPOINT_MIN_OCCURRENCES,
  REDUNDANT_QUERY_MIN_COUNT,
  LARGE_RESPONSE_BYTES,
  HIGH_ROW_COUNT,
  OVERFETCH_MIN_REQUESTS,
} from "../../../constants/thresholds.js";
