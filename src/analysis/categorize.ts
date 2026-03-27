/**
 * Request categorization. Classifies each captured request into a category
 * (page, api, static, auth, polling, etc.) by URL patterns and response headers.
 */
import type { TracedRequest, RequestCategory } from "../types/index.js";

function isAuthPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.startsWith("/api/auth") || lower.startsWith("/clerk") || lower.startsWith("/api/clerk");
}

export function detectCategory(req: TracedRequest): RequestCategory {
  const { method, url, statusCode, responseHeaders } = req;

  if (req.isStatic) return "static";
  if (req.isHealthCheck) return "health-check";

  // 307 redirect with Clerk auth handshake params
  if (
    statusCode === 307 &&
    (url.includes("__clerk_handshake") || url.includes("__clerk_db_jwt"))
  ) {
    return "auth-handshake";
  }

  // Classify based on WHERE middleware rewrote to, not that middleware touched it
  const effectivePath = getEffectivePath(req);

  if (isAuthPath(effectivePath)) {
    return "auth-check";
  }

  if (method === "POST" && !effectivePath.startsWith("/api/")) {
    return "server-action";
  }

  if (
    effectivePath.startsWith("/api/") &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    return "api-call";
  }

  if (effectivePath.startsWith("/api/") && method === "GET") {
    return "data-fetch";
  }

  if (url.includes("_rsc=")) {
    return "navigation";
  }

  if (responseHeaders["x-middleware-rewrite"]) {
    return "middleware";
  }

  if (method === "GET") {
    const ct = responseHeaders["content-type"] ?? "";
    if (ct.includes("text/html")) return "page-load";
  }

  return "unknown";
}

/** Cookie name prefixes that indicate authentication credentials. */
const AUTH_COOKIE_NAMES = [
  "__session=", "__clerk", "__host-next-auth", "next-auth.session-token=",
  "auth_token=", "session_id=", "access_token=", "_session=", "appsession=",
];

/**
 * Detect whether a request carries authentication credentials.
 * Catches inline auth patterns (e.g. requireAuth() inside handlers)
 * that URL-based category detection misses.
 */
export function hasAuthCredentials(req: TracedRequest): boolean {
  // Authorization header (Bearer, Basic, etc.)
  if (req.headers["authorization"]) return true;

  // Session cookies from common auth providers
  const cookie = (req.headers["cookie"] || "").toLowerCase();
  if (cookie && AUTH_COOKIE_NAMES.some((name) => cookie.includes(name))) return true;

  // 401 response = endpoint requires auth
  if (req.statusCode === 401) return true;

  return false;
}

export function getEffectivePath(req: TracedRequest): string {
  const rewrite = req.responseHeaders["x-middleware-rewrite"];
  if (!rewrite) return req.path;
  try {
    const url = new URL(rewrite, "http://localhost");
    return url.pathname;
  } catch {
    return rewrite.startsWith("/") ? rewrite : req.path;
  }
}
