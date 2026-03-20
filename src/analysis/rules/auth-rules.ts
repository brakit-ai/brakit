import type { SecurityRule } from "./rule.js";
import type { SecurityFinding, TracedRequest } from "../../types/index.js";
import { SECRET_KEYS, MASKED_RE, TOKEN_PARAMS, SAFE_PARAMS, RULE_HINTS } from "./patterns.js";
import { SECRET_SCAN_ARRAY_LIMIT, MIN_SECRET_VALUE_LENGTH, MAX_OBJECT_SCAN_DEPTH } from "../../constants/config.js";
import { isErrorStatus, isRedirect } from "../../utils/http-status.js";

// ── Exposed Secret Detection ──

function findSecretKeys(obj: unknown, prefix: string, depth = 0): string[] {
  const found: string[] = [];
  if (depth >= MAX_OBJECT_SCAN_DEPTH) return found;
  if (!obj || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, SECRET_SCAN_ARRAY_LIMIT); i++) {
      found.push(...findSecretKeys(obj[i], prefix, depth + 1));
    }
    return found;
  }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[k];
    if (SECRET_KEYS.test(k) && typeof val === "string" && val.length >= MIN_SECRET_VALUE_LENGTH && !MASKED_RE.test(val)) {
      found.push(k);
    }
    if (typeof val === "object" && val !== null) {
      found.push(...findSecretKeys(val, prefix + k + ".", depth + 1));
    }
  }
  return found;
}

export const exposedSecretRule: SecurityRule = {
  id: "exposed-secret",
  severity: "critical",
  name: "Exposed Secret in Response",
  hint: RULE_HINTS["exposed-secret"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Map<string, SecurityFinding>();

    for (const r of ctx.requests) {
      if (isErrorStatus(r.statusCode)) continue;
      const parsed = ctx.parsedBodies.response.get(r.id);
      if (!parsed) continue;
      const keys = findSecretKeys(parsed, "");
      if (keys.length === 0) continue;
      const ep = `${r.method} ${r.path}`;
      const dedupKey = `${ep}:${keys.sort().join(",")}`;
      const existing = seen.get(dedupKey);
      if (existing) { existing.count++; continue; }
      const finding: SecurityFinding = {
        severity: "critical",
        rule: "exposed-secret",
        title: "Exposed Secret in Response",
        desc: `${ep} — response contains ${keys.join(", ")} field${keys.length > 1 ? "s" : ""}`,
        hint: this.hint,
        endpoint: ep,
        count: 1,
      };
      seen.set(dedupKey, finding);
      findings.push(finding);
    }
    return findings;
  },
};

// ── Token in URL Detection ──

export const tokenInUrlRule: SecurityRule = {
  id: "token-in-url",
  severity: "critical",
  name: "Auth Token in URL",
  hint: RULE_HINTS["token-in-url"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Map<string, SecurityFinding>();

    for (const r of ctx.requests) {
      const qIdx = r.url.indexOf("?");
      if (qIdx === -1) continue;
      const params = r.url.substring(qIdx + 1).split("&");
      const flagged: string[] = [];
      for (const param of params) {
        const [name, ...rest] = param.split("=");
        const val = rest.join("=");
        if (SAFE_PARAMS.test(name)) continue;
        if (TOKEN_PARAMS.test(name) && val && val.length > 0) {
          flagged.push(name);
        }
      }
      if (flagged.length === 0) continue;
      const ep = `${r.method} ${r.path}`;
      const dedupKey = `${ep}:${flagged.sort().join(",")}`;
      const existing = seen.get(dedupKey);
      if (existing) { existing.count++; continue; }
      const finding: SecurityFinding = {
        severity: "critical",
        rule: "token-in-url",
        title: "Auth Token in URL",
        desc: `${ep} — ${flagged.join(", ")} exposed in query string`,
        hint: this.hint,
        endpoint: ep,
        count: 1,
      };
      seen.set(dedupKey, finding);
      findings.push(finding);
    }
    return findings;
  },
};

// ── Insecure Cookie Detection ──

function isFrameworkResponse(r: TracedRequest): boolean {
  if (isRedirect(r.statusCode)) return true;
  if (r.path?.startsWith("/__")) return true;
  if (r.responseHeaders?.["x-middleware-rewrite"]) return true;
  return false;
}

export const insecureCookieRule: SecurityRule = {
  id: "insecure-cookie",
  severity: "warning",
  name: "Insecure Cookie",
  hint: RULE_HINTS["insecure-cookie"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Map<string, SecurityFinding>();

    for (const r of ctx.requests) {
      if (!r.responseHeaders) continue;
      if (isFrameworkResponse(r)) continue;
      const setCookie = r.responseHeaders["set-cookie"];
      if (!setCookie) continue;
      const cookies = setCookie.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
      for (const cookie of cookies) {
        const cookieName = cookie.trim().split("=")[0].trim();
        const lower = cookie.toLowerCase();
        const issues: string[] = [];
        if (!lower.includes("httponly")) issues.push("HttpOnly");
        if (!lower.includes("samesite")) issues.push("SameSite");
        if (issues.length === 0) continue;
        const dedupKey = `${cookieName}:${issues.join(",")}`;
        const existing = seen.get(dedupKey);
        if (existing) { existing.count++; continue; }
        const finding: SecurityFinding = {
          severity: "warning",
          rule: "insecure-cookie",
          title: "Insecure Cookie",
          desc: `${cookieName} — missing ${issues.join(", ")} flag${issues.length > 1 ? "s" : ""}`,
          hint: this.hint,
          endpoint: cookieName,
          count: 1,
        };
        seen.set(dedupKey, finding);
        findings.push(finding);
      }
    }
    return findings;
  },
};

// ── CORS Credentials with Wildcard Detection ──

export const corsCredentialsRule: SecurityRule = {
  id: "cors-credentials",
  severity: "warning",
  name: "CORS Credentials with Wildcard",
  hint: RULE_HINTS["cors-credentials"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Set<string>();

    for (const r of ctx.requests) {
      if (!r.responseHeaders) continue;
      const origin = r.responseHeaders["access-control-allow-origin"];
      const creds = r.responseHeaders["access-control-allow-credentials"];
      if (origin !== "*" || creds !== "true") continue;
      const ep = `${r.method} ${r.path}`;
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
