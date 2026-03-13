/** Client runtime constants — limits and durations for the browser-side dashboard app. */

export const CLIENT_MAX_REQUESTS = 1_000;
export const CLIENT_RELOAD_DEBOUNCE_MS = 300;
export const CLIENT_TOAST_DURATION_MS = 2_000;
export const CLIENT_SENSITIVE_MASK_THRESHOLD = 8;

/** SSE reconnection with exponential backoff. */
export const SSE_RECONNECT_BASE_MS = 1_000;
export const SSE_RECONNECT_MAX_MS = 30_000;
export const SSE_MAX_RETRIES = 10;
