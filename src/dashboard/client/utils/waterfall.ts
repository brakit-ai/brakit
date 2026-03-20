/**
 * Waterfall chart data builder.
 *
 * Transforms flow requests and their activity timelines into positioned
 * waterfall rows for rendering. Handles mixed timestamp bases (performance.now
 * vs Date.now) gracefully by detecting the time base and falling back to
 * proportional positioning when they differ.
 */

import type { FlowData, FlowRequest, FlowActivityData, TimelineData, TimelineEvent, TracedQuery, TracedFetch } from "../store/types.js";
import { formatDuration } from "./format.js";
import { methodColor } from "./request-colors.js";
import {
  WF_MIN_REQ_BAR_PCT,
  WF_MIN_SUB_BAR_PCT,
  WF_TIME_BASE_TOLERANCE,
  WF_MAX_LEFT_PCT,
  WF_PROPORTIONAL_SPREAD,
} from "../constants/layout.js";

export interface WaterfallRow {
  label: string;
  leftPct: number;
  widthPct: number;
  color: string;
  durLabel: string;
  durMs: number;
  tooltip: string;
  subEvents: WaterfallSubEvent[];
}

export interface WaterfallSubEvent {
  type: "query" | "fetch";
  label: string;
  durLabel: string;
  durMs: number;
  tooltip: string;
  leftPct: number;
  widthPct: number;
}

export interface WaterfallData {
  rows: WaterfallRow[];
  totalMs: number;
}

type TimedEvent =
  | { type: "query"; timestamp: number; data: TracedQuery }
  | { type: "fetch"; timestamp: number; data: TracedFetch };

function isTimedEvent(evt: TimelineEvent): evt is TimedEvent {
  return evt.type === "query" || evt.type === "fetch";
}

function buildQueryLabel(q: TracedQuery): { label: string; tooltip: string } {
  const op = (q.normalizedOp || q.operation || "QUERY").toUpperCase();
  const table = q.table || q.model || "";
  return {
    label: `${op} ${table}`,
    tooltip: q.sql || `${op} ${table}`,
  };
}

function buildFetchLabel(f: TracedFetch): { label: string; tooltip: string } {
  return {
    label: `${f.method} ${f.url}`,
    tooltip: `${f.method} ${f.url}`,
  };
}

/**
 * Compute the position of a sub-event within its parent request's duration.
 * Returns { leftPct, widthPct } as percentages (0–100) of the request bar.
 */
function computeSubEventPosition(
  evt: TimedEvent,
  evtIndex: number,
  timedEvents: TimedEvent[],
  reqStart: number,
  reqDur: number,
  sameBase: boolean,
): { leftPct: number; widthPct: number } {
  const dur = evt.data.durationMs || 0;
  let leftPct: number;
  let widthPct: number;

  if (sameBase) {
    const offset = Math.max(evt.timestamp - reqStart, 0);
    leftPct = Math.min((offset / reqDur) * 100, WF_MAX_LEFT_PCT);
    widthPct = Math.max((dur / reqDur) * 100, WF_MIN_SUB_BAR_PCT);
  } else {
    const firstTs = timedEvents[0].timestamp;
    const lastTs = timedEvents[timedEvents.length - 1].timestamp;
    const span = lastTs - firstTs;
    leftPct = span > 0
      ? ((evt.timestamp - firstTs) / span) * WF_PROPORTIONAL_SPREAD
      : (evtIndex / Math.max(timedEvents.length - 1, 1)) * WF_PROPORTIONAL_SPREAD;
    widthPct = Math.max((dur / reqDur) * 100, WF_MIN_SUB_BAR_PCT);
  }

  // Clamp to prevent overflow
  if (leftPct + widthPct > 100) {
    widthPct = Math.max(100 - leftPct, WF_MIN_SUB_BAR_PCT);
  }

  return { leftPct, widthPct };
}

function buildSubEvents(
  activity: TimelineData,
  req: FlowRequest,
): WaterfallSubEvent[] {
  const timed = activity.timeline.filter(isTimedEvent);
  if (timed.length === 0) return [];

  const reqStart = req.startedAt;
  const reqDur = req.durationMs || 1;

  // Detect if sub-events share the same time base (performance.now) as the request
  const sameBase = Math.abs(timed[0].timestamp - reqStart) < reqDur * WF_TIME_BASE_TOLERANCE;

  return timed.map((evt, idx) => {
    const dur = evt.data.durationMs || 0;
    const { leftPct, widthPct } = computeSubEventPosition(evt, idx, timed, reqStart, reqDur, sameBase);

    const info = evt.type === "query"
      ? buildQueryLabel(evt.data)
      : buildFetchLabel(evt.data);

    return {
      type: evt.type,
      label: info.label,
      durMs: dur,
      durLabel: formatDuration(dur),
      tooltip: info.tooltip,
      leftPct,
      widthPct,
    };
  });
}

/**
 * Build waterfall rows from a flow's requests and their activity data.
 * Filters out React Strict Mode duplicates.
 */
export function buildWaterfallRows(
  flow: FlowData,
  timeline: FlowActivityData | null,
): WaterfallData {
  const reqs = flow.requests.filter((r) => !r.isStrictModeDupe);
  if (reqs.length === 0) return { rows: [], totalMs: 0 };

  const baseTime = Math.min(...reqs.map((r) => r.startedAt));
  const endTime = Math.max(...reqs.map((r) => r.startedAt + r.durationMs));
  const totalMs = endTime - baseTime;
  if (totalMs === 0) return { rows: [], totalMs: 0 };

  const rows: WaterfallRow[] = reqs.map((req) => {
    const reqLeftPct = ((req.startedAt - baseTime) / totalMs) * 100;
    const reqWidthPct = Math.max((req.durationMs / totalMs) * 100, WF_MIN_REQ_BAR_PCT);

    const activity = timeline?.activities?.[req.id];
    const subEvents = activity ? buildSubEvents(activity, req) : [];

    return {
      label: `${req.method} ${req.label}`,
      leftPct: reqLeftPct,
      widthPct: reqWidthPct,
      color: methodColor(req.method, req.statusCode),
      durMs: req.durationMs,
      durLabel: formatDuration(req.durationMs),
      tooltip: `${req.method} ${req.label} (${formatDuration(req.durationMs)})`,
      subEvents,
    };
  });

  return { rows, totalMs };
}
