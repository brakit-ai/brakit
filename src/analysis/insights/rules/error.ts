import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";

export const errorRule: InsightRule = {
  id: "error",
  check(ctx: PreparedInsightContext): Insight[] {
    if (ctx.errors.length === 0) return [];

    const insights: Insight[] = [];
    const groups = new Map<string, number>();
    for (const e of ctx.errors) {
      const name = e.name || "Error";
      groups.set(name, (groups.get(name) ?? 0) + 1);
    }

    for (const [name, cnt] of groups) {
      insights.push({
        severity: "critical",
        type: "error",
        title: "Unhandled Error",
        desc: `${name} — occurred ${cnt} time${cnt !== 1 ? "s" : ""}`,
        hint: "Unhandled errors crash request handlers. Wrap async code in try/catch or add error-handling middleware.",
        nav: "errors",
      });
    }

    return insights;
  },
};
