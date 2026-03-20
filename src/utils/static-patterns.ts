const STATIC_PATTERNS = [
  /\.(?:js|css|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/,
  /^\/favicon/,
  /^\/node_modules\//,
  // Framework-specific static/internal paths
  /^\/_next\//,
  /^\/__nextjs/,
  /^\/@vite\//,
  /^\/__vite/,
];

export function isStaticPath(urlPath: string): boolean {
  return STATIC_PATTERNS.some((p) => p.test(urlPath));
}

const HEALTH_CHECK_PATTERNS = [
  /^\/health(z|check)?$/i,
  /^\/ping$/i,
  /^\/(ready|readiness|liveness)$/i,
  /^\/status$/i,
  /^\/__health$/i,
  /^\/api\/health(z|check)?$/i,
];

export function isHealthCheckPath(urlPath: string): boolean {
  return HEALTH_CHECK_PATTERNS.some((p) => p.test(urlPath));
}
