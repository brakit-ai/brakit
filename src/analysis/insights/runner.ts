import type { InsightRule } from "./rule.js";
import type { Insight, InsightContext } from "./types.js";
import { buildInsightContext } from "./prepare.js";
import { brakitDebug } from "../../utils/log.js";
import { getErrorMessage } from "../../utils/type-guards.js";

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export class InsightRunner {
  private rules: InsightRule[] = [];

  register(rule: InsightRule): void {
    this.rules.push(rule);
  }

  run(ctx: InsightContext): Insight[] {
    const prepared = buildInsightContext(ctx);
    const insights: Insight[] = [];

    for (const rule of this.rules) {
      try {
        insights.push(...rule.check(prepared));
      } catch (e) {
        brakitDebug(`insight rule ${rule.id} failed: ${getErrorMessage(e)}`);
      }
    }

    insights.sort((a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2),
    );

    return insights;
  }
}
