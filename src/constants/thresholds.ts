export const FLOW_GAP_MS = 5_000;
export const SLOW_REQUEST_THRESHOLD_MS = 2_000;
export const MIN_POLLING_SEQUENCE = 3;
export const ENDPOINT_TRUNCATE_LENGTH = 12;
export const SHUTDOWN_TIMEOUT_MS = 3_000;

// Insight detection thresholds (shared with client-side constants)
export const N1_QUERY_THRESHOLD = 5;
export const ERROR_RATE_THRESHOLD_PCT = 20;
export const SLOW_ENDPOINT_THRESHOLD_MS = 1_000;
export const MIN_REQUESTS_FOR_INSIGHT = 2;
export const HIGH_QUERY_COUNT_PER_REQ = 5;
export const AUTH_OVERHEAD_PCT = 30;
export const CROSS_ENDPOINT_MIN_ENDPOINTS = 3;
export const CROSS_ENDPOINT_PCT = 50;
export const CROSS_ENDPOINT_MIN_OCCURRENCES = 5;
export const REDUNDANT_QUERY_MIN_COUNT = 2;
export const LARGE_RESPONSE_BYTES = 51_200;
export const HIGH_ROW_COUNT = 100;
export const OVERFETCH_MIN_REQUESTS = 2;
