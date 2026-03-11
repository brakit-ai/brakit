export const POSTHOG_HOST = "https://us.i.posthog.com";
export const POSTHOG_CAPTURE_PATH = "/i/v0/e/";
export const POSTHOG_REQUEST_TIMEOUT_MS = 3_000;
export const POSTHOG_SPAWN_TIMEOUT_MS = 5_000;
export const SIGNAL_EXIT_SIGINT = 130;
export const SIGNAL_EXIT_SIGTERM = 143;

/**
 * Thresholds (in ms) for categorizing endpoint response times
 * into human-readable buckets for telemetry reporting.
 */
export const SPEED_BUCKET_THRESHOLDS = [200, 500, 1_000, 2_000, 5_000] as const;
