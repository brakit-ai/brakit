import type { Insight } from "./insights.js";
import type { StatefulInsight } from "../types/insight-lifecycle.js";
import type { AiFixStatus } from "../types/finding-lifecycle.js";
import { extractEndpointFromDesc } from "../utils/endpoint.js";
import { computeInsightId } from "../store/finding-id.js";
import { RESOLVE_AFTER_ABSENCES, RESOLVED_INSIGHT_TTL_MS } from "../constants/thresholds.js";

export type { InsightState, StatefulInsight } from "../types/insight-lifecycle.js";

function computeInsightKey(insight: Insight): string {
  const identifier = extractEndpointFromDesc(insight.desc) ?? insight.title;
  return `${insight.type}:${identifier}`;
}

function enrichedIdFromInsight(insight: Insight): string {
  return computeInsightId(insight.type, insight.nav ?? "global", insight.desc);
}

export class InsightTracker {
  private tracked = new Map<string, StatefulInsight>();
  private enrichedIndex = new Map<string, string>();

  reconcile(current: readonly Insight[]): readonly StatefulInsight[] {
    const currentKeys = new Set<string>();
    const now = Date.now();

    for (const insight of current) {
      const key = computeInsightKey(insight);
      currentKeys.add(key);
      const existing = this.tracked.get(key);

      this.enrichedIndex.set(enrichedIdFromInsight(insight), key);

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
          aiStatus: null,
          aiNotes: null,
        });
      }
    }

    for (const [, stateful] of this.tracked) {
      if ((stateful.state === "open" || stateful.state === "fixing") && !currentKeys.has(stateful.key)) {
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
        this.tracked.delete(stateful.key);
        this.enrichedIndex.delete(enrichedIdFromInsight(stateful.insight));
      }
    }

    return [...this.tracked.values()];
  }

  reportFix(enrichedId: string, status: AiFixStatus, notes: string): boolean {
    const key = this.enrichedIndex.get(enrichedId);
    if (!key) return false;
    const stateful = this.tracked.get(key);
    if (!stateful) return false;
    stateful.aiStatus = status;
    stateful.aiNotes = notes;
    if (status === "fixed") {
      stateful.state = "fixing";
    }
    return true;
  }

  getAll(): readonly StatefulInsight[] {
    return [...this.tracked.values()];
  }

  clear(): void {
    this.tracked.clear();
    this.enrichedIndex.clear();
  }
}
