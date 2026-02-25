const STATIC_PATTERNS = [
  /^\/_next\//,
  /\.(?:js|css|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|eot)$/,
  /^\/favicon/,
  /^\/__nextjs/,
];

export function isStaticPath(urlPath: string): boolean {
  return STATIC_PATTERNS.some((p) => p.test(urlPath));
}
