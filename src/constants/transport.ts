export const TRANSPORT_FLUSH_INTERVAL_MS = 50;
export const TRANSPORT_FLUSH_BATCH_SIZE = 20;
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

/** Hosts whose fetches are framework noise, not user app traffic. */
export const NOISE_HOSTS: readonly string[] = [
  "registry.npmjs.org",
  "telemetry.nextjs.org",
  "vitejs.dev",
];

/** Path substrings that indicate dev-tool traffic, not user app fetches. */
export const NOISE_PATH_PATTERNS: readonly string[] = [
  ".hot-update.",
  "__webpack",
  "__vite",
];
