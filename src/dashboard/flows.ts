import { randomUUID } from "node:crypto";
import type {
  TracedRequest,
  LabeledRequest,
  RequestFlow,
  RequestCategory,
} from "../types.js";

const FLOW_GAP_MS = 5000;

// --- Source Page Extraction ---

/** Parse referer header to extract the page path, e.g. "http://localhost:3002/history" → "/history" */
export function extractSourcePage(req: TracedRequest): string | undefined {
  const referer = req.headers["referer"] ?? req.headers["Referer"];
  if (!referer) return undefined;
  try {
    const url = new URL(referer);
    return url.pathname;
  } catch {
    return undefined;
  }
}

// --- Request Labeling ---

export function labelRequest(req: TracedRequest): LabeledRequest {
  const category = detectCategory(req);
  const label = generateHumanLabel(req, category);
  const sourcePage = extractSourcePage(req);
  return { ...req, category, label, sourcePage };
}

function detectCategory(req: TracedRequest): RequestCategory {
  const { method, url, statusCode, responseHeaders } = req;

  // Static assets
  if (req.isStatic) return "static";

  // Auth handshake: 307 redirect with clerk handshake params
  if (
    statusCode === 307 &&
    (url.includes("__clerk_handshake") || url.includes("__clerk_db_jwt"))
  ) {
    return "auth-handshake";
  }

  // Resolve the effective path — if middleware rewrote the request,
  // classify based on WHERE it was rewritten to, not that middleware touched it.
  const effectivePath = getEffectivePath(req);

  // Auth check endpoints
  if (/^\/api\/auth/i.test(effectivePath) || /^\/(api\/)?clerk/i.test(effectivePath)) {
    return "auth-check";
  }

  // Server Action: POST to a page route with RSC-like response
  if (method === "POST" && !effectivePath.startsWith("/api/")) {
    const ct = responseHeaders["content-type"] ?? "";
    if (ct.includes("text/x-component") || ct.includes("text/plain")) {
      return "server-action";
    }
    return "server-action";
  }

  // API calls (mutations)
  if (
    effectivePath.startsWith("/api/") &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    return "api-call";
  }

  // Data fetch (GET /api/*)
  if (effectivePath.startsWith("/api/") && method === "GET") {
    return "data-fetch";
  }

  // Client-side navigation (RSC)
  if (url.includes("_rsc=")) {
    return "navigation";
  }

  // Middleware rewrite to a non-API route
  if (responseHeaders["x-middleware-rewrite"]) {
    return "middleware";
  }

  // Page load
  if (method === "GET") {
    const ct = responseHeaders["content-type"] ?? "";
    if (ct.includes("text/html")) return "page-load";
  }

  return "unknown";
}

/** Extract the actual target path from a middleware rewrite, or fall back to req.path */
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

// --- Human-Readable Labels ---

function generateHumanLabel(req: TracedRequest, category: RequestCategory): string {
  const effectivePath = getEffectivePath(req);
  const endpointName = getEndpointName(effectivePath);
  const failed = req.statusCode >= 400;

  switch (category) {
    case "auth-handshake":
      return "Auth handshake";
    case "auth-check":
      return failed ? "Auth check failed" : "Checked auth";
    case "middleware": {
      const rewritePath = effectivePath !== req.path ? effectivePath : "";
      return rewritePath ? `Redirected to ${rewritePath}` : "Middleware";
    }
    case "server-action": {
      const name = prettifyEndpoint(req.path);
      return failed ? `${name} failed` : name;
    }
    case "api-call": {
      const action = deriveActionVerb(req.method, endpointName);
      const name = prettifyEndpoint(endpointName);
      if (failed) return `${action} ${name} failed`;
      return `${action} ${name}`;
    }
    case "data-fetch": {
      const name = prettifyEndpoint(endpointName);
      if (failed) return `Failed to load ${name}`;
      return `Loaded ${name}`;
    }
    case "page-load":
      return failed ? "Page error" : "Loaded page";
    case "navigation":
      return "Navigated";
    case "static":
      return `Static: ${req.path.split("/").pop() ?? req.path}`;
    default:
      return failed
        ? `${req.method} ${req.path} failed`
        : `${req.method} ${req.path}`;
  }
}

/** Turn an endpoint name into a human-friendly label */
function prettifyEndpoint(name: string): string {
  // "/api/videos/status" → "videos/status" → "video status"
  const cleaned = name
    .replace(/^\/api\//, "")
    .replace(/\//g, " ")
    .replace(/\.\.\./g, "")
    .trim();

  if (!cleaned) return "data";

  // Singularize common patterns: "videos" → "video", "users" → "user"
  // but not "status", "progress", etc.
  return cleaned
    .split(" ")
    .map((word) => {
      if (word.endsWith("ses") || word.endsWith("us") || word.endsWith("ss")) return word;
      if (word.endsWith("ies")) return word.slice(0, -3) + "y";
      if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

/** Derive a human-friendly action verb from HTTP method + endpoint */
function deriveActionVerb(method: string, endpointName: string): string {
  const lower = endpointName.toLowerCase();

  // Check if the endpoint itself contains a verb
  const verbMap: [RegExp, string][] = [
    [/enhance/, "Enhanced"],
    [/generate/, "Generated"],
    [/create/, "Created"],
    [/update/, "Updated"],
    [/delete|remove/, "Deleted"],
    [/send/, "Sent"],
    [/upload/, "Uploaded"],
    [/save/, "Saved"],
    [/submit/, "Submitted"],
    [/login|signin/, "Logged in"],
    [/logout|signout/, "Logged out"],
    [/register|signup/, "Registered"],
  ];

  for (const [pattern, verb] of verbMap) {
    if (pattern.test(lower)) return verb;
  }

  // Fall back to HTTP method
  switch (method) {
    case "POST": return "Created";
    case "PUT":
    case "PATCH": return "Updated";
    case "DELETE": return "Deleted";
    default: return "Called";
  }
}

function getEndpointName(path: string): string {
  const parts = path.replace(/^\/api\//, "").split("/");
  if (parts.length <= 2) return parts.join("/");
  return parts
    .map((p) => (p.length > 12 ? "..." : p))
    .join("/");
}

// --- Flow Grouping (Referer-based) ---

export function groupRequestsIntoFlows(
  requests: readonly TracedRequest[],
): RequestFlow[] {
  if (requests.length === 0) return [];

  const flows: RequestFlow[] = [];
  let currentRequests: LabeledRequest[] = [];
  let currentSourcePage: string | undefined;
  let lastEndTime = 0;

  for (const req of requests) {
    // Skip brakit's own requests
    if (req.path.startsWith("/__brakit")) continue;

    const labeled = labelRequest(req);

    // Skip static assets from flows
    if (labeled.category === "static") continue;

    const sourcePage = labeled.sourcePage;
    const gap = currentRequests.length > 0 ? req.startedAt - lastEndTime : 0;

    // Start a new flow when:
    // 1. Source page changed (user navigated to a different page)
    // 2. Time gap exceeded (fallback for same-page distinct actions)
    // 3. This is a page-load/navigation (always starts a new flow)
    const isNewPage =
      currentRequests.length > 0 &&
      sourcePage !== undefined &&
      currentSourcePage !== undefined &&
      sourcePage !== currentSourcePage;
    const isPageLoad = labeled.category === "page-load" || labeled.category === "navigation";
    const isTimeGap = currentRequests.length > 0 && gap > FLOW_GAP_MS;

    if (currentRequests.length > 0 && (isNewPage || isTimeGap || isPageLoad)) {
      flows.push(buildFlow(currentRequests));
      currentRequests = [];
    }

    currentRequests.push(labeled);
    currentSourcePage = sourcePage ?? currentSourcePage;
    lastEndTime = Math.max(lastEndTime, req.startedAt + req.durationMs);
  }

  if (currentRequests.length > 0) {
    flows.push(buildFlow(currentRequests));
  }

  return flows;
}

function buildFlow(rawRequests: LabeledRequest[]): RequestFlow {
  // Mark duplicates before collapsing polling
  markDuplicates(rawRequests);

  // Collapse polling sequences
  const requests = collapsePolling(rawRequests);

  const first = requests[0];
  const startTime = first.startedAt;
  const endTime = Math.max(
    ...requests.map((r) =>
      r.pollingDurationMs
        ? r.startedAt + r.pollingDurationMs
        : r.startedAt + r.durationMs,
    ),
  );

  // Compute redundancy %
  const duplicateCount = rawRequests.filter((r) => r.isDuplicate).length;
  const nonStaticCount = rawRequests.length;
  const redundancyPct =
    nonStaticCount > 0 ? Math.round((duplicateCount / nonStaticCount) * 100) : 0;

  // Determine source page from the most common referer
  const sourcePage = getDominantSourcePage(rawRequests);

  return {
    id: randomUUID(),
    label: deriveFlowLabel(requests, sourcePage),
    requests,
    startTime,
    totalDurationMs: Math.round(endTime - startTime),
    hasErrors: requests.some((r) => r.statusCode >= 400),
    warnings: detectWarnings(rawRequests),
    sourcePage,
    redundancyPct,
  };
}

// --- Duplicate Marking ---

function markDuplicates(requests: LabeledRequest[]): void {
  const seen = new Map<string, LabeledRequest>();

  for (const req of requests) {
    // Only mark data fetches and auth checks as potential duplicates
    if (req.category !== "data-fetch" && req.category !== "auth-check") continue;

    const key = `${req.method} ${getEffectivePath(req).split("?")[0]}`;
    const first = seen.get(key);

    if (first) {
      req.isDuplicate = true;
    } else {
      seen.set(key, req);
    }
  }
}

/** Find the most common source page among requests */
function getDominantSourcePage(requests: LabeledRequest[]): string {
  const counts = new Map<string, number>();
  for (const req of requests) {
    if (req.sourcePage) {
      counts.set(req.sourcePage, (counts.get(req.sourcePage) ?? 0) + 1);
    }
  }

  let best = "";
  let bestCount = 0;
  for (const [page, count] of counts) {
    if (count > bestCount) {
      best = page;
      bestCount = count;
    }
  }

  return best || requests[0]?.path?.split("?")[0] || "/";
}

// --- Polling Collapse ---

function collapsePolling(requests: LabeledRequest[]): LabeledRequest[] {
  const result: LabeledRequest[] = [];
  let i = 0;

  while (i < requests.length) {
    const current = requests[i];
    const currentEffective = getEffectivePath(current).split("?")[0];

    if (current.method === "GET" && current.category === "data-fetch") {
      let j = i + 1;
      while (
        j < requests.length &&
        requests[j].method === "GET" &&
        getEffectivePath(requests[j]).split("?")[0] === currentEffective
      ) {
        j++;
      }

      const count = j - i;
      if (count >= 3) {
        const last = requests[j - 1];
        const pollingDuration =
          last.startedAt + last.durationMs - current.startedAt;
        const endpointName = prettifyEndpoint(currentEffective);
        result.push({
          ...current,
          category: "polling",
          label: `Polling ${endpointName} (${count}x, ${formatDurationLabel(pollingDuration)})`,
          pollingCount: count,
          pollingDurationMs: pollingDuration,
          isDuplicate: false,
        });
        i = j;
        continue;
      }
    }

    result.push(current);
    i++;
  }

  return result;
}

function formatDurationLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// --- Flow Labels ---

function deriveFlowLabel(requests: LabeledRequest[], sourcePage: string): string {
  // Find the most meaningful request as the flow trigger
  const trigger =
    requests.find((r) => r.category === "api-call") ??
    requests.find((r) => r.category === "server-action") ??
    requests.find((r) => r.category === "page-load") ??
    requests.find((r) => r.category === "navigation") ??
    requests.find((r) => r.category === "data-fetch") ??
    requests[0];

  if (trigger.category === "page-load" || trigger.category === "navigation") {
    const pageName = prettifyPageName(trigger.path.split("?")[0]);
    return `${pageName} Page`;
  }

  if (trigger.category === "api-call") {
    const effectivePath = getEffectivePath(trigger);
    const action = deriveActionVerb(trigger.method, getEndpointName(effectivePath));
    const name = prettifyEndpoint(getEndpointName(effectivePath));
    return `${action} ${capitalize(name)}`;
  }

  if (trigger.category === "server-action") {
    const name = prettifyEndpoint(trigger.path);
    return capitalize(name);
  }

  if (trigger.category === "data-fetch" || trigger.category === "polling") {
    // Use the source page if available
    if (sourcePage && sourcePage !== "/") {
      const pageName = prettifyPageName(sourcePage);
      return `${pageName} Page`;
    }
    return trigger.label;
  }

  return trigger.label;
}

/** Turn a URL path into a nice page name: "/history" → "History", "/dashboard/settings" → "Dashboard Settings" */
function prettifyPageName(path: string): string {
  const clean = path
    .replace(/^\//, "")
    .replace(/\/$/, "");

  if (!clean) return "Home";

  return clean
    .split("/")
    .map((s) => capitalize(s.replace(/[-_]/g, " ")))
    .join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Warnings ---

function detectWarnings(requests: LabeledRequest[]): string[] {
  const warnings: string[] = [];

  // Count duplicates
  const duplicateCount = requests.filter((r) => r.isDuplicate).length;
  if (duplicateCount > 0) {
    const unique = new Set(
      requests
        .filter((r) => r.isDuplicate)
        .map((r) => `${r.method} ${getEffectivePath(r).split("?")[0]}`),
    );
    const endpoints = unique.size;
    const sameData = requests
      .filter((r) => r.isDuplicate)
      .every((r) => {
        const key = `${r.method} ${getEffectivePath(r).split("?")[0]}`;
        const first = requests.find(
          (o) =>
            !o.isDuplicate &&
            `${o.method} ${getEffectivePath(o).split("?")[0]}` === key,
        );
        return first && first.responseBody === r.responseBody;
      });

    const suffix = sameData ? " — same data loaded twice" : "";
    warnings.push(
      `${duplicateCount} request${duplicateCount > 1 ? "s" : ""} duplicated across ${endpoints} endpoint${endpoints > 1 ? "s" : ""}${suffix}`,
    );
  }

  // Flag slow requests (> 2s)
  const slowRequests = requests.filter(
    (r) => r.durationMs > 2000 && r.category !== "polling",
  );
  for (const req of slowRequests) {
    warnings.push(`${req.label} took ${(req.durationMs / 1000).toFixed(1)}s`);
  }

  // Flag errors
  const errors = requests.filter((r) => r.statusCode >= 500);
  for (const req of errors) {
    warnings.push(`${req.label} — server error (${req.statusCode})`);
  }

  return warnings;
}
