import type { InsightRule } from "./rule.js";
import type { Insight, InsightContext } from "./types.js";
import { prepareContext } from "./prepare.js";

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export class InsightRunner {
  private rules: InsightRule[] = [];

  register(rule: InsightRule): void {
    this.rules.push(rule);
  }

  run(ctx: InsightContext): Insight[] {
    const prepared = prepareContext(ctx);
    const insights: Insight[] = [];

    for (const rule of this.rules) {
      try {
        insights.push(...rule.check(prepared));
      } catch {
        // One rule failing does not stop others
      }
    }

    insights.sort((a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2),
    );

    return insights;
  }
}
