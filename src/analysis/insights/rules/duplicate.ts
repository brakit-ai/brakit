import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { MAX_DUPLICATE_INSIGHTS } from "../../../constants/thresholds.js";

export const duplicateRule: InsightRule = {
  id: "duplicate",
  check(ctx: PreparedInsightContext): Insight[] {
    const dupCounts = new Map<string, number>();
    const flowCount = new Map<string, number>();

    for (const flow of ctx.flows) {
      if (!flow.requests) continue;
      const seenInFlow = new Set<string>();
      for (const fr of flow.requests) {
        if (!(fr as { isDuplicate?: boolean }).isDuplicate) continue;
        const dupKey = `${fr.method} ${(fr as { label?: string }).label ?? fr.path ?? fr.url}`;
        dupCounts.set(dupKey, (dupCounts.get(dupKey) ?? 0) + 1);
        if (!seenInFlow.has(dupKey)) {
          seenInFlow.add(dupKey);
          flowCount.set(dupKey, (flowCount.get(dupKey) ?? 0) + 1);
        }
      }
    }

    const dupEntries = [...dupCounts.entries()]
      .map(([key, count]) => ({ key, count, flows: flowCount.get(key) ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const insights: Insight[] = [];
    for (let i = 0; i < Math.min(dupEntries.length, MAX_DUPLICATE_INSIGHTS); i++) {
      const d = dupEntries[i];
      insights.push({
        severity: "warning",
        type: "duplicate",
        title: "Duplicate API Call",
        desc: `${d.key} loaded ${d.count}x as duplicate across ${d.flows} action${d.flows !== 1 ? "s" : ""}`,
        hint: "Multiple components independently fetch the same endpoint. Lift the fetch to a parent component, use a data cache, or deduplicate with React Query / SWR.",
        nav: "actions",
      });
    }

    return insights;
  },
};
