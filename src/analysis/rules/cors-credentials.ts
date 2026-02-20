import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { RULE_HINTS } from "./patterns.js";

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
