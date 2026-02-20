import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { LOG_SECRET_RE, RULE_HINTS } from "./patterns.js";

export const sensitiveLogsRule: SecurityRule = {
  id: "sensitive-logs",
  severity: "warning",
  name: "Sensitive Data in Logs",
  hint: RULE_HINTS["sensitive-logs"],

  check(ctx) {
    let count = 0;
    for (const log of ctx.logs) {
      if (!log.message) continue;
      if (log.message.startsWith("[brakit]")) continue;
      if (LOG_SECRET_RE.test(log.message)) count++;
    }
    if (count === 0) return [];
    return [{
      severity: "warning" as const,
      rule: "sensitive-logs",
      title: "Sensitive Data in Logs",
      desc: `Console output contains secret/token values — ${count} occurrence${count !== 1 ? "s" : ""}`,
      hint: this.hint,
      endpoint: "console",
      count,
    }];
  },
};
