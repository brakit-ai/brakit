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
export const DASHBOARD_API_LOGS = "/__brakit/api/logs";
export const DASHBOARD_API_FETCHES = "/__brakit/api/fetches";
export const DASHBOARD_API_ERRORS = "/__brakit/api/errors";
export const DASHBOARD_API_QUERIES = "/__brakit/api/queries";
export const DASHBOARD_API_INGEST = "/__brakit/api/ingest";
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_API_LIMIT = 500;

// Instrumentation
export const BRAKIT_REQUEST_ID_HEADER = "x-brakit-request-id";
export const MAX_TELEMETRY_ENTRIES = 1_000;

// Client-side (injected into browser JS template strings)
export const CLIENT_MAX_REQUESTS = 1_000;
export const CLIENT_RELOAD_DEBOUNCE_MS = 300;
export const CLIENT_TOAST_DURATION_MS = 2_000;
export const CLIENT_SENSITIVE_MASK_THRESHOLD = 8;
