// ── CLI ──

/** File extensions recognized as source files during uninstall scanning. */
export const SUPPORTED_SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts",
]);

/**
 * Framework build cache directories cleared during uninstall to remove
 * stale brakit references that would cause recompilation errors.
 */
export const BUILD_CACHE_DIRS = [".next", ".nuxt", ".output"] as const;

/** Directories scanned as a fallback when no known instrumentation files are found. */
export const FALLBACK_SCAN_DIRS = ["src", "."] as const;

// ── MCP ──

export const MCP_SERVER_NAME = "brakit";
export const INITIAL_DISCOVERY_TIMEOUT_MS = 5_000;
export const LAZY_DISCOVERY_TIMEOUT_MS = 2_000;
export const CLIENT_FETCH_TIMEOUT_MS = 10_000;
export const HEALTH_CHECK_TIMEOUT_MS = 3_000;
export const DISCOVERY_POLL_INTERVAL_MS = 500;
export const MAX_DISCOVERY_DEPTH = 5;
export const MAX_TIMELINE_EVENTS = 20;
export const MAX_RESOLVED_DISPLAY = 5;

export const ENRICHMENT_SEVERITY_FILTER: readonly string[] = ["critical", "warning"];

export const MCP_SERVER_VERSION = process.env.BRAKIT_VERSION ?? "0.0.0";

// ── Network ──

export const CLOUD_SIGNALS = [
  "VERCEL", "VERCEL_ENV", "NETLIFY", "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_EXECUTION_ENV", "ECS_CONTAINER_METADATA_URI", "GOOGLE_CLOUD_PROJECT",
  "GCP_PROJECT", "K_SERVICE", "AZURE_FUNCTIONS_ENVIRONMENT",
  "WEBSITE_SITE_NAME", "FLY_APP_NAME", "RAILWAY_ENVIRONMENT", "RENDER",
  "HEROKU_APP_NAME", "DYNO", "CF_INSTANCE_GUID", "CF_PAGES",
  "KUBERNETES_SERVICE_HOST",
] as const;

export const MAX_HEALTH_ERRORS = 10;
export const RECOVERY_WINDOW_MS = 5 * 60 * 1000;

export const PORT_MIN = 1;
export const PORT_MAX = 65535;

export const LOCALHOST_IPS: Set<string> = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
export const LOCALHOST_HOSTNAMES: Set<string> = new Set(["localhost", "127.0.0.1", "::1"]);

export const URL_PARSE_BASE = "http://localhost";

/** Directory permission mode for user-only access (rwx------). */
export const DIR_MODE_OWNER_ONLY = 0o700;
/** File permission mode for user-only access (rw-------). */
export const FILE_MODE_OWNER_ONLY = 0o600;
