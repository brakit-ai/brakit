import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { DB_CONN_RE, SQL_FRAGMENT_RE, SECRET_VAL_RE, RULE_HINTS } from "./patterns.js";

const CRITICAL_PATTERNS = [
  { re: DB_CONN_RE, label: "database connection string" },
  { re: SQL_FRAGMENT_RE, label: "SQL query fragment" },
  { re: SECRET_VAL_RE, label: "secret value" },
];

export const errorInfoLeakRule: SecurityRule = {
  id: "error-info-leak",
  severity: "critical",
  name: "Sensitive Data in Error Response",
  hint: RULE_HINTS["error-info-leak"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Map<string, SecurityFinding>();

    for (const r of ctx.requests) {
      if (r.statusCode < 400) continue;
      if (!r.responseBody) continue;
      if (r.responseHeaders["x-nextjs-error"] || r.responseHeaders["x-nextjs-matched-path"]) continue;
      const ep = `${r.method} ${r.path}`;
      for (const p of CRITICAL_PATTERNS) {
        if (!p.re.test(r.responseBody)) continue;
        const dedupKey = `${ep}:${p.label}`;
        const existing = seen.get(dedupKey);
        if (existing) { existing.count++; continue; }
        const finding: SecurityFinding = {
          severity: "critical",
          rule: "error-info-leak",
          title: "Sensitive Data in Error Response",
          desc: `${ep} — error response exposes ${p.label}`,
          hint: this.hint,
          endpoint: ep,
          count: 1,
        };
        seen.set(dedupKey, finding);
        findings.push(finding);
      }
    }
    return findings;
  },
};
