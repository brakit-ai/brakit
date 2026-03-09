export const DASHBOARD_PREFIX = "/__brakit";
export const DASHBOARD_API_REQUESTS = `${DASHBOARD_PREFIX}/api/requests` as const;
export const DASHBOARD_API_EVENTS = `${DASHBOARD_PREFIX}/api/events` as const;
export const DASHBOARD_API_FLOWS = `${DASHBOARD_PREFIX}/api/flows` as const;
export const DASHBOARD_API_CLEAR = `${DASHBOARD_PREFIX}/api/clear` as const;
export const DASHBOARD_API_LOGS = `${DASHBOARD_PREFIX}/api/logs` as const;
export const DASHBOARD_API_FETCHES = `${DASHBOARD_PREFIX}/api/fetches` as const;
export const DASHBOARD_API_ERRORS = `${DASHBOARD_PREFIX}/api/errors` as const;
export const DASHBOARD_API_QUERIES = `${DASHBOARD_PREFIX}/api/queries` as const;
export const DASHBOARD_API_INGEST = `${DASHBOARD_PREFIX}/api/ingest` as const;
export const DASHBOARD_API_METRICS = `${DASHBOARD_PREFIX}/api/metrics` as const;
export const DASHBOARD_API_ACTIVITY = `${DASHBOARD_PREFIX}/api/activity` as const;
export const DASHBOARD_API_METRICS_LIVE = `${DASHBOARD_PREFIX}/api/metrics/live` as const;
export const DASHBOARD_API_INSIGHTS = `${DASHBOARD_PREFIX}/api/insights` as const;
export const DASHBOARD_API_SECURITY = `${DASHBOARD_PREFIX}/api/security` as const;
export const DASHBOARD_API_TAB = `${DASHBOARD_PREFIX}/api/tab` as const;
export const DASHBOARD_API_FINDINGS = `${DASHBOARD_PREFIX}/api/findings` as const;
export const DASHBOARD_API_FINDINGS_REPORT = `${DASHBOARD_PREFIX}/api/findings/report` as const;

const VALID_TABS_TUPLE = [
  "overview", "actions", "requests", "fetches", "queries",
  "errors", "logs", "performance", "security",
] as const;

export const VALID_TABS: Set<string> = new Set(VALID_TABS_TUPLE);
