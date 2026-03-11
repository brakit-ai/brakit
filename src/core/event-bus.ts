import type {
  TracedFetch,
  TracedQuery,
  TracedLog,
  TracedError,
  TracedRequest,
  SecurityFinding,
} from "../types/index.js";
import { brakitDebug } from "../utils/log.js";
import type { StatefulIssue } from "../types/issue-lifecycle.js";
import type { Insight } from "../analysis/insights.js";

export interface AnalysisUpdate {
  insights: readonly Insight[];
  findings: readonly SecurityFinding[];
  issues: readonly StatefulIssue[];
}

export interface ChannelMap {
  "telemetry:fetch": Omit<TracedFetch, "id">;
  "telemetry:query": Omit<TracedQuery, "id">;
  "telemetry:log": Omit<TracedLog, "id">;
  "telemetry:error": Omit<TracedError, "id">;
  "request:completed": TracedRequest;
  "analysis:updated": AnalysisUpdate;
  "issues:changed": readonly StatefulIssue[];
  "store:cleared": undefined;
}

type Listener<T> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  emit<K extends keyof ChannelMap>(channel: K, data: ChannelMap[K]): void {
    const set = this.listeners.get(channel);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as Listener<ChannelMap[K]>)(data);
      } catch (err) {
        brakitDebug(`EventBus listener threw on channel "${channel}": ${err}`);
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
    set.add(fn as Listener<unknown>);
    return () => set!.delete(fn as Listener<unknown>);
  }

  off<K extends keyof ChannelMap>(
    channel: K,
    fn: Listener<ChannelMap[K]>,
  ): void {
    this.listeners.get(channel)?.delete(fn as Listener<unknown>);
  }
}
