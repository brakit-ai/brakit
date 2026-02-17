// Request Store
export const MAX_REQUEST_ENTRIES = 1_000;
export const DEFAULT_MAX_BODY_CAPTURE = 10_240;

// Analysis
export const FLOW_GAP_MS = 5_000;
export const SLOW_REQUEST_THRESHOLD_MS = 2_000;
export const MIN_POLLING_SEQUENCE = 3;
export const ENDPOINT_TRUNCATE_LENGTH = 12;

// Process
export const SHUTDOWN_TIMEOUT_MS = 3_000;
export const DEV_OUTPUT_MAX_LINE_LENGTH = 300;

// Dashboard routes
export const DASHBOARD_PREFIX = "/__brakit";
export const DASHBOARD_API_REQUESTS = "/__brakit/api/requests";
export const DASHBOARD_API_EVENTS = "/__brakit/api/events";
export const DASHBOARD_API_FLOWS = "/__brakit/api/flows";
export const DASHBOARD_API_CLEAR = "/__brakit/api/clear";
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_API_LIMIT = 500;

// Client-side (injected into browser JS template strings)
export const CLIENT_MAX_REQUESTS = 1_000;
export const CLIENT_RELOAD_DEBOUNCE_MS = 300;
export const CLIENT_TOAST_DURATION_MS = 2_000;
export const CLIENT_SENSITIVE_MASK_THRESHOLD = 8;
