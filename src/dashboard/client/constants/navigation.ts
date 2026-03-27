/** View navigation labels, containers, titles, and subtitles. */

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
  graph: "Graph",
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
  graph: "Runtime dependency graph of your application",
};
