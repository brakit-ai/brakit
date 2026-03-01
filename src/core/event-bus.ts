import type {
  TracedFetch,
  TracedQuery,
  TracedLog,
  TracedError,
  TracedRequest,
  SecurityFinding,
} from "../types/index.js";
import type { StatefulFinding } from "../types/finding-lifecycle.js";
import type { StatefulInsight } from "../types/insight-lifecycle.js";
import type { Insight } from "../analysis/insights.js";

export interface AnalysisUpdate {
  insights: Insight[];
  findings: SecurityFinding[];
  statefulFindings: readonly StatefulFinding[];
  statefulInsights: readonly StatefulInsight[];
}

export interface ChannelMap {
  "telemetry:fetch": Omit<TracedFetch, "id">;
  "telemetry:query": Omit<TracedQuery, "id">;
  "telemetry:log": Omit<TracedLog, "id">;
  "telemetry:error": Omit<TracedError, "id">;
  "request:completed": TracedRequest;
  "analysis:updated": AnalysisUpdate;
  "store:cleared": void;
}

type Listener<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Function>>();

  emit<K extends keyof ChannelMap>(channel: K, data: ChannelMap[K]): void {
    const set = this.listeners.get(channel);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as Listener<ChannelMap[K]>)(data);
      } catch {
        // Listener failure is non-fatal
      }
    }
  }

  on<K extends keyof ChannelMap>(
    channel: K,
    fn: Listener<ChannelMap[K]>,
  ): () => void {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  off<K extends keyof ChannelMap>(
    channel: K,
    fn: Listener<ChannelMap[K]>,
  ): void {
    this.listeners.get(channel)?.delete(fn);
  }
}
