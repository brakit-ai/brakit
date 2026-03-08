export const TRANSPORT_FLUSH_INTERVAL_MS = 50;
export const TRANSPORT_FLUSH_BATCH_SIZE = 20;
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;
export const NOISE_HOSTS = ["registry.npmjs.org", "telemetry.nextjs.org", "vitejs.dev"] as const;
export const NOISE_PATH_PATTERNS = [".hot-update.", "__webpack", "__vite"] as const;
