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
