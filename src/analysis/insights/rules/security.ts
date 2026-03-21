import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";

export const securityRule: InsightRule = {
  id: "security",
  check(ctx: PreparedInsightContext): Insight[] {
    if (!ctx.securityFindings) return [];

    return ctx.securityFindings.map((finding) => ({
      severity: finding.severity,
      type: "security" as const,
      title: finding.title,
      desc: finding.desc,
      hint: finding.hint,
      detail: finding.detail,
    }));
  },
};
