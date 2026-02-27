export const MCP_SERVER_NAME = "brakit";
export const MCP_SERVER_VERSION = process.env.BRAKIT_VERSION ?? "0.0.0";

export const INITIAL_DISCOVERY_TIMEOUT_MS = 5_000;
export const LAZY_DISCOVERY_TIMEOUT_MS = 2_000;
export const CLIENT_FETCH_TIMEOUT_MS = 10_000;
export const HEALTH_CHECK_TIMEOUT_MS = 3_000;
export const DISCOVERY_POLL_INTERVAL_MS = 500;

export const MAX_TIMELINE_EVENTS = 20;
export const MAX_RESOLVED_DISPLAY = 5;

export const ENRICHMENT_SEVERITY_FILTER: readonly string[] = ["critical", "warning"];
