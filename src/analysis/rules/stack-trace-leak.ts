import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { STACK_TRACE_RE, RULE_HINTS } from "./patterns.js";

export const stackTraceLeakRule: SecurityRule = {
  id: "stack-trace-leak",
  severity: "critical",
  name: "Stack Trace Leaked to Client",
  hint: RULE_HINTS["stack-trace-leak"],

  check(ctx) {
    const findings: SecurityFinding[] = [];
    const seen = new Map<string, SecurityFinding>();

    for (const r of ctx.requests) {
      if (!r.responseBody) continue;
      if (!STACK_TRACE_RE.test(r.responseBody)) continue;
      const ep = `${r.method} ${r.path}`;
      const existing = seen.get(ep);
      if (existing) { existing.count++; continue; }
      const finding: SecurityFinding = {
        severity: "critical",
        rule: "stack-trace-leak",
        title: "Stack Trace Leaked to Client",
        desc: `${ep} — response exposes internal stack trace`,
        hint: this.hint,
        endpoint: ep,
        count: 1,
      };
      seen.set(ep, finding);
      findings.push(finding);
    }
    return findings;
  },
};
