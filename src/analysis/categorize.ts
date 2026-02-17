import type { TracedRequest, RequestCategory } from "../types/index.js";

export function detectCategory(req: TracedRequest): RequestCategory {
  const { method, url, statusCode, responseHeaders } = req;

  if (req.isStatic) return "static";

  // 307 redirect with Clerk auth handshake params
  if (
    statusCode === 307 &&
    (url.includes("__clerk_handshake") || url.includes("__clerk_db_jwt"))
  ) {
    return "auth-handshake";
  }

  // Classify based on WHERE middleware rewrote to, not that middleware touched it
  const effectivePath = getEffectivePath(req);

  if (/^\/api\/auth/i.test(effectivePath) || /^\/(api\/)?clerk/i.test(effectivePath)) {
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
