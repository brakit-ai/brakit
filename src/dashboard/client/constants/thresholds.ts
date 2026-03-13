/** Client-only display thresholds. */

/** Health grade thresholds — response time buckets in milliseconds. */
export const HEALTH_FAST_MS = 100;
export const HEALTH_GOOD_MS = 300;
export const HEALTH_OK_MS = 800;
export const HEALTH_SLOW_MS = 2_000;

export const SLOW_QUERY_THRESHOLD_MS = 100;

export const TIMELINE_CACHE_MAX = 50;
export const PERF_RELOAD_DEBOUNCE_MS = 500;

export {
  HIGH_QUERY_COUNT_PER_REQ,
  LARGE_RESPONSE_BYTES,
  SLOW_REQUEST_THRESHOLD_MS,
  CLEAN_HITS_FOR_RESOLUTION,
} from "../../../constants/thresholds.js";
