import type { Insight } from "./insights.js";
import type { StatefulInsight } from "../types/insight-lifecycle.js";
import { extractEndpointFromDesc } from "../utils/endpoint.js";
import { RESOLVE_AFTER_ABSENCES, RESOLVED_INSIGHT_TTL_MS } from "../constants/thresholds.js";

export type { InsightState, StatefulInsight } from "../types/insight-lifecycle.js";

function computeInsightKey(insight: Insight): string {
  const identifier = extractEndpointFromDesc(insight.desc) ?? insight.title;
  return `${insight.type}:${identifier}`;
}

export class InsightTracker {
  private tracked = new Map<string, StatefulInsight>();

  reconcile(current: readonly Insight[]): readonly StatefulInsight[] {
    const currentKeys = new Set<string>();
    const now = Date.now();

    for (const insight of current) {
      const key = computeInsightKey(insight);
      currentKeys.add(key);
      const existing = this.tracked.get(key);

      if (existing) {
        existing.insight = insight;
        existing.lastSeenAt = now;
        existing.consecutiveAbsences = 0;
        if (existing.state === "resolved") {
          existing.state = "open";
          existing.resolvedAt = null;
        }
      } else {
        this.tracked.set(key, {
          key,
          state: "open",
          insight,
          firstSeenAt: now,
          lastSeenAt: now,
          resolvedAt: null,
          consecutiveAbsences: 0,
        });
      }
    }

    for (const [key, stateful] of this.tracked) {
      if (stateful.state === "open" && !currentKeys.has(stateful.key)) {
        stateful.consecutiveAbsences++;
        if (stateful.consecutiveAbsences >= RESOLVE_AFTER_ABSENCES) {
          stateful.state = "resolved";
          stateful.resolvedAt = now;
        }
      } else if (
        stateful.state === "resolved" &&
        stateful.resolvedAt !== null &&
        now - stateful.resolvedAt > RESOLVED_INSIGHT_TTL_MS
      ) {
        this.tracked.delete(key);
      }
    }

    return [...this.tracked.values()];
  }

  getAll(): readonly StatefulInsight[] {
    return [...this.tracked.values()];
  }

  clear(): void {
    this.tracked.clear();
  }
}
