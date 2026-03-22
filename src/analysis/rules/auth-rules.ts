import type { SecurityRule } from "./rule.js";
import type { SecurityFinding, TracedRequest } from "../../types/index.js";
import { SECRET_KEYS, MASKED_RE, TOKEN_PARAMS, SAFE_PARAMS, RULE_HINTS } from "./patterns.js";
import { MIN_SECRET_VALUE_LENGTH } from "../../constants/config.js";
import { isErrorStatus, isRedirect } from "../../utils/http-status.js";
import { deduplicateFindings } from "../../utils/collections.js";
import { collectFromObject } from "../../utils/object-scan.js";


function findSecretKeys(obj: unknown): string[] {
  return collectFromObject(obj, (key, val) =>
    SECRET_KEYS.test(key) && typeof val === "string" && val.length >= MIN_SECRET_VALUE_LENGTH && !MASKED_RE.test(val)
      ? key
      : null,
  );
}

export const exposedSecretRule: SecurityRule = {
  id: "exposed-secret",
  severity: "critical",
  name: "Exposed Secret in Response",
  hint: RULE_HINTS["exposed-secret"],

  check(ctx) {
    return deduplicateFindings(ctx.requests, (request) => {
      if (isErrorStatus(request.statusCode)) return null;
      const parsed = ctx.parsedBodies.response.get(request.id);
      if (!parsed) return null;
      const keys = findSecretKeys(parsed);
      if (keys.length === 0) return null;
      const ep = `${request.method} ${request.path}`;
      return {
        key: `${ep}:${keys.sort().join(",")}`,
        finding: {
          severity: "critical",
          rule: "exposed-secret",
          title: "Exposed Secret in Response",
          desc: `${ep} — response contains ${keys.join(", ")} field${keys.length > 1 ? "s" : ""}`,
          hint: this.hint,
          detail: `Exposed fields: ${keys.join(", ")}. ${keys.length} unmasked secret value${keys.length !== 1 ? "s" : ""} in response body.`,
          endpoint: ep,
          count: 1,
        },
      };
    });
  },
};


export const tokenInUrlRule: SecurityRule = {
  id: "token-in-url",
  severity: "critical",
  name: "Auth Token in URL",
  hint: RULE_HINTS["token-in-url"],

  check(ctx) {
    return deduplicateFindings(ctx.requests, (request) => {
      const qIdx = request.url.indexOf("?");
      if (qIdx === -1) return null;
      const params = request.url.substring(qIdx + 1).split("&");
      const flagged: string[] = [];
      for (const param of params) {
        const [name, ...rest] = param.split("=");
        const val = rest.join("=");
        if (SAFE_PARAMS.test(name)) continue;
        if (TOKEN_PARAMS.test(name) && val && val.length > 0) {
          flagged.push(name);
        }
      }
      if (flagged.length === 0) return null;
      const ep = `${request.method} ${request.path}`;
      return {
        key: `${ep}:${flagged.sort().join(",")}`,
        finding: {
          severity: "critical",
          rule: "token-in-url",
          title: "Auth Token in URL",
          desc: `${ep} — ${flagged.join(", ")} exposed in query string`,
          hint: this.hint,
          detail: `Parameters in URL: ${flagged.join(", ")}. Auth tokens in URLs are logged by proxies, browsers, and CDNs.`,
          endpoint: ep,
          count: 1,
        },
      };
    });
  },
};


function isFrameworkResponse(request: TracedRequest): boolean {
  if (isRedirect(request.statusCode)) return true;
  if (request.path?.startsWith("/__")) return true;
  if (request.responseHeaders?.["x-middleware-rewrite"]) return true;
  return false;
}

export const insecureCookieRule: SecurityRule = {
  id: "insecure-cookie",
  severity: "warning",
  name: "Insecure Cookie",
  hint: RULE_HINTS["insecure-cookie"],

  check(ctx) {
    const cookieEntries: { cookie: string }[] = [];
    for (const request of ctx.requests) {
      if (!request.responseHeaders) continue;
      if (isFrameworkResponse(request)) continue;
      const setCookie = request.responseHeaders["set-cookie"];
      if (!setCookie) continue;
      const cookies = setCookie.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
      for (const cookie of cookies) {
        cookieEntries.push({ cookie });
      }
    }

    return deduplicateFindings(cookieEntries, ({ cookie }) => {
      const cookieName = cookie.trim().split("=")[0].trim();
      const lower = cookie.toLowerCase();
      const issues: string[] = [];
      if (!lower.includes("httponly")) issues.push("HttpOnly");
      if (!lower.includes("samesite")) issues.push("SameSite");
      if (issues.length === 0) return null;
      return {
        key: `${cookieName}:${issues.join(",")}`,
        finding: {
          severity: "warning",
          rule: "insecure-cookie",
          title: "Insecure Cookie",
          desc: `${cookieName} — missing ${issues.join(", ")} flag${issues.length > 1 ? "s" : ""}`,
          hint: this.hint,
          detail: `Missing: ${issues.join(", ")}. ${issues.includes("HttpOnly") ? "Cookie accessible via JavaScript (XSS risk). " : ""}${issues.includes("SameSite") ? "Cookie sent on cross-site requests (CSRF risk)." : ""}`,
          endpoint: cookieName,
          count: 1,
        },
      };
    });
  },
};


export const corsCredentialsRule: SecurityRule = {
  id: "cors-credentials",
  severity: "warning",
  name: "CORS Credentials with Wildcard",
  hint: RULE_HINTS["cors-credentials"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Set<string>();

    for (const request of ctx.requests) {
      if (!request.responseHeaders) continue;
      const origin = request.responseHeaders["access-control-allow-origin"];
      const creds = request.responseHeaders["access-control-allow-credentials"];
      if (origin !== "*" || creds !== "true") continue;
      const ep = `${request.method} ${request.path}`;
      if (seen.has(ep)) continue;
      seen.add(ep);
      findings.push({
        severity: "warning",
        rule: "cors-credentials",
        title: "CORS Credentials with Wildcard",
        desc: `${ep} — credentials:true with origin:* (browser will reject)`,
        hint: this.hint,
        endpoint: ep,
        count: 1,
      });
    }
    return findings;
  },
};
