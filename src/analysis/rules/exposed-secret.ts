import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { SECRET_KEYS, MASKED_RE, RULE_HINTS } from "./patterns.js";

function tryParseJson(body: string | null): unknown {
  if (!body) return null;
  try { return JSON.parse(body); } catch { return null; }
}

function findSecretKeys(obj: unknown, prefix: string): string[] {
  const found: string[] = [];
  if (!obj || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, 5); i++) {
      found.push(...findSecretKeys(obj[i], prefix));
    }
    return found;
  }
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[k];
    if (SECRET_KEYS.test(k) && typeof val === "string" && val.length >= 8 && !MASKED_RE.test(val)) {
      found.push(k);
    }
    if (typeof val === "object" && val !== null) {
      found.push(...findSecretKeys(val, prefix + k + "."));
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
      if (r.statusCode >= 400) continue;
      const parsed = tryParseJson(r.responseBody);
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
