import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";

export const securityRule: InsightRule = {
  id: "security",
  check(ctx: PreparedInsightContext): Insight[] {
    if (!ctx.securityFindings) return [];

    return ctx.securityFindings.map((f) => ({
      severity: f.severity,
      type: "security" as const,
      title: f.title,
      desc: f.desc,
      hint: f.hint,
      nav: "security",
    }));
  },
};
