/** View navigation labels, containers, titles, and subtitles. */

export const NAV_LABELS: Record<string, string> = {
  overview: "Overview",
  queries: "Queries",
  requests: "Requests",
  actions: "Actions",
  errors: "Errors",
  security: "Security",
  fetches: "Fetches",
  logs: "Logs",
  performance: "Performance",
};

export const VIEW_CONTAINERS: Record<string, string> = {
  overview: "overview-container",
  actions: "flow-container",
  requests: "request-container",
  fetches: "fetch-container",
  queries: "query-container",
  errors: "error-container",
  logs: "log-container",
  performance: "performance-container",
  security: "security-container",
};

export const VIEW_TITLES: Record<string, string> = {
  overview: "Overview",
  actions: "Actions",
  requests: "Requests",
  fetches: "Server Fetches",
  queries: "Queries",
  errors: "Errors",
  logs: "Logs",
  performance: "Performance",
  security: "Security",
};

export const VIEW_SUBTITLES: Record<string, string> = {
  overview: "Live summary of your application",
  actions: "User actions captured as sequences of HTTP requests",
  requests: "All HTTP requests proxied through brakit",
  fetches: "Outbound HTTP calls made by your server to external services",
  queries: "Database queries executed during request handling",
  errors: "Unhandled exceptions and errors thrown by your application",
  logs: "Console output from your application",
  performance: "Endpoint health and response time trends",
  security: "Security findings and recommendations",
};
