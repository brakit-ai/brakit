/** API path constants — single source of truth for all dashboard API endpoints. */

export const API_PREFIX = "/__brakit/api";
export const DASHBOARD_PREFIX = "/__brakit";

export const API = {
  flows: `${API_PREFIX}/flows`,
  requests: `${API_PREFIX}/requests`,
  events: `${API_PREFIX}/events`,
  clear: `${API_PREFIX}/clear`,
  fetches: `${API_PREFIX}/fetches`,
  errors: `${API_PREFIX}/errors`,
  logs: `${API_PREFIX}/logs`,
  queries: `${API_PREFIX}/queries`,
  metricsLive: `${API_PREFIX}/metrics/live`,
  insights: `${API_PREFIX}/insights`,
  tab: `${API_PREFIX}/tab`,
  activity: `${API_PREFIX}/activity`,
  graph: `${API_PREFIX}/graph`,
} as const;

export type ApiEndpoint = keyof typeof API;
