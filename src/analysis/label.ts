import type {
  TracedRequest,
  LabeledRequest,
  RequestCategory,
} from "../types/index.js";
import { ENDPOINT_TRUNCATE_LENGTH } from "../constants.js";
import { detectCategory, getEffectivePath } from "./categorize.js";

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

export function labelRequest(req: TracedRequest): LabeledRequest {
  const category = detectCategory(req);
  const label = generateHumanLabel(req, category);
  const sourcePage = extractSourcePage(req);
  return { ...req, category, label, sourcePage };
}

function generateHumanLabel(
  req: TracedRequest,
  category: RequestCategory,
): string {
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

export function prettifyEndpoint(name: string): string {
  const cleaned = name
    .replace(/^\/api\//, "")
    .replace(/\//g, " ")
    .replace(/\.\.\./g, "")
    .trim();

  if (!cleaned) return "data";

  return cleaned
    .split(" ")
    .map((word) => {
      if (word.endsWith("ses") || word.endsWith("us") || word.endsWith("ss"))
        return word;
      if (word.endsWith("ies")) return word.slice(0, -3) + "y";
      if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

export function deriveActionVerb(method: string, endpointName: string): string {
  const lower = endpointName.toLowerCase();

  const VERB_PATTERNS: [RegExp, string][] = [
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

  for (const [pattern, verb] of VERB_PATTERNS) {
    if (pattern.test(lower)) return verb;
  }

  switch (method) {
    case "POST":
      return "Created";
    case "PUT":
    case "PATCH":
      return "Updated";
    case "DELETE":
      return "Deleted";
    default:
      return "Called";
  }
}

function getEndpointName(path: string): string {
  const parts = path.replace(/^\/api\//, "").split("/");
  if (parts.length <= 2) return parts.join("/");
  return parts
    .map((p) => (p.length > ENDPOINT_TRUNCATE_LENGTH ? "..." : p))
    .join("/");
}

export function prettifyPageName(path: string): string {
  const clean = path.replace(/^\//, "").replace(/\/$/, "");

  if (!clean) return "Home";

  return clean
    .split("/")
    .map((s) => capitalize(s.replace(/[-_]/g, " ")))
    .join(" ");
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
