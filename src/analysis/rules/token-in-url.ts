import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { TOKEN_PARAMS, SAFE_PARAMS, RULE_HINTS } from "./patterns.js";

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
