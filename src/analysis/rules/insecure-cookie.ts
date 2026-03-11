import type { SecurityRule } from "./rule.js";
import type { SecurityFinding, TracedRequest } from "../../types/index.js";
import { RULE_HINTS } from "./patterns.js";
import { isRedirect } from "../../utils/http-status.js";

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
