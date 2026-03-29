/** View navigation labels and explorer tab definitions. */

import type { NavigableView } from "../store/types.js";

export const VIEW_TITLES: Record<NavigableView, string> = {
  overview: "Overview",
  actions: "Actions",
  insights: "Insights",
  performance: "Performance",
  graph: "Graph",
  explorer: "Explorer",
  requests: "Requests",
  fetches: "Server Fetches",
  queries: "Queries",
  errors: "Errors",
  logs: "Logs",
  security: "Security",
};

export const VIEW_SUBTITLES: Record<NavigableView, string> = {
  overview: "Live summary of your application",
  actions: "User actions captured as sequences of HTTP requests",
  insights: "Security findings, error patterns, and issue tracking",
  performance: "Endpoint health and response time trends",
  graph: "Runtime dependency graph of your application",
  explorer: "Browse raw requests, fetches, queries, logs, and errors",
  requests: "All HTTP requests proxied through brakit",
  fetches: "Outbound HTTP calls made by your server to external services",
  queries: "Database queries executed during request handling",
  errors: "Unhandled exceptions and errors thrown by your application",
  logs: "Console output from your application",
  security: "Security findings and recommendations",
};

export type ExplorerTab = "requests" | "fetches" | "queries" | "logs" | "errors";

export const EXPLORER_TABS: readonly { key: ExplorerTab; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "fetches", label: "Fetches" },
  { key: "queries", label: "Queries" },
  { key: "logs", label: "Logs" },
  { key: "errors", label: "Errors" },
];
