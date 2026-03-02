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
