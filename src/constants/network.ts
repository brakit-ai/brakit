/** IPv4/IPv6 loopback addresses used for localhost detection. */
export const LOCALHOST_IPS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);

/** Hostnames considered local for CORS origin validation. */
export const LOCALHOST_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

/** Environment variables indicating a cloud/CI environment (not local dev). */
export const CLOUD_SIGNALS = [
  "VERCEL", "VERCEL_ENV", "NETLIFY",
  "AWS_LAMBDA_FUNCTION_NAME", "AWS_EXECUTION_ENV",
  "GOOGLE_CLOUD_PROJECT", "GCP_PROJECT",
  "AZURE_FUNCTIONS_ENVIRONMENT",
  "FLY_APP_NAME", "RAILWAY_ENVIRONMENT",
  "RENDER", "HEROKU", "CF_PAGES",
  "KUBERNETES_SERVICE_HOST", "ECS_CONTAINER_METADATA_URI",
] as const;

/** Circuit breaker: disable brakit after this many errors. */
export const MAX_HEALTH_ERRORS = 10;
