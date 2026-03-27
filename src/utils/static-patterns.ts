const STATIC_EXTENSIONS = new Set([
  ".js", ".css", ".map", ".ico", ".png", ".jpg", ".jpeg", ".gif",
  ".svg", ".webp", ".woff", ".woff2", ".ttf", ".eot",
]);

const STATIC_PREFIXES = [
  "/favicon",
  "/node_modules/",
  // Next.js
  "/_next/",
  "/__nextjs",
  // Vite (also used by Nuxt, Astro in dev)
  "/@vite/",
  "/__vite",
  "/@fs/",
  "/@id/",
  // Remix
  "/__remix",
  // Nuxt
  "/_nuxt/",
  "/__nuxt",
  // Astro
  "/@astro",
  "/_astro/",
  // Django
  "/static/",
  "/media/",
  "/__debug__/",
  // Flask / Werkzeug
  "/_debugtoolbar/",
  // FastAPI / Starlette
  "/openapi.json",
  "/docs",
  "/redoc",
  // Rails
  "/assets/",
  "/packs/",
  // Browser probes
  "/.well-known/",
];

export function isStaticPath(urlPath: string): boolean {
  const dotIdx = urlPath.lastIndexOf(".");
  if (dotIdx !== -1) {
    const ext = urlPath.slice(dotIdx).toLowerCase();
    if (STATIC_EXTENSIONS.has(ext)) return true;
  }
  return STATIC_PREFIXES.some((p) => urlPath.startsWith(p));
}

const HEALTH_CHECK_PATHS = new Set([
  "/health", "/healthz", "/healthcheck",
  "/ping",
  "/ready", "/readiness", "/liveness",
  "/status",
  "/__health",
  "/api/health", "/api/healthz", "/api/healthcheck",
]);

export function isHealthCheckPath(urlPath: string): boolean {
  return HEALTH_CHECK_PATHS.has(urlPath.toLowerCase());
}
