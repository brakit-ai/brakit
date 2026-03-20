/**
 * Flow analysis logic extracted from flows-view.
 * Analyzes a flow's requests to produce actionable insights.
 */

import {
  formatDuration,
  formatSize,
  httpStatus,
} from "./format.js";
import {
  LARGE_RESPONSE_BYTES,
  AUTH_SKIP_CATEGORIES,
  SLOW_REQUEST_THRESHOLD_MS,
  CATEGORY_POLLING,
} from "../constants.js";
import type { FlowData, FlowInsight } from "../store/types.js";

/**
 * Analyze a flow's requests to identify errors, duplicates, warnings, and tips.
 */
export function analyzeFlow(flow: FlowData): FlowInsight {
  const reqs = flow.requests;
  const successes: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicates: { name: string; count: number; wastedMs: number }[] = [];
  const seen = new Map<string, { name: string; count: number; wastedMs: number }>();

  for (const req of reqs) {
    const label = req.label;
    const dur = req.pollingDurationMs || req.durationMs;

    if (AUTH_SKIP_CATEGORIES[req.category || ""]) continue;

    if (req.isDuplicate) {
      const ex = seen.get(label);
      if (ex) {
        ex.count++;
        ex.wastedMs += dur;
      } else {
        seen.set(label, { name: label, count: 2, wastedMs: dur });
      }
      continue;
    }
    if (req.statusCode >= 400) {
      errors.push(label + " (" + httpStatus(req.statusCode) + ")");
      continue;
    }
    if (req.responseSize > LARGE_RESPONSE_BYTES) {
      warnings.push("Large response: " + label + " returned " + formatSize(req.responseSize));
    }
    successes.push(label);
  }

  for (const d of seen.values()) duplicates.push(d);

  let tip = "";
  if (duplicates.length > 0) {
    const names = duplicates.map((d) => d.name).join(", ");
    const totalWaste = duplicates.reduce((s, d) => s + d.wastedMs, 0);
    tip =
      "Your app fetches " + names + " multiple times on this page. This wastes ~" +
      formatDuration(totalWaste) +
      ". Try caching these calls, deduplicating with React Query/SWR, or moving them to a shared layout.";
  } else if (errors.length > 0) {
    tip = "Some requests are failing. Check your API routes and make sure the endpoints exist.";
  }
  const slow = reqs.filter(
    (r) => r.durationMs > SLOW_REQUEST_THRESHOLD_MS && r.category !== CATEGORY_POLLING,
  );
  if (slow.length > 0 && !tip) {
    tip =
      slow.map((r) => r.label).join(", ") +
      ` is taking over ${formatDuration(SLOW_REQUEST_THRESHOLD_MS)}. Consider adding caching or optimizing the backend query.`;
  }
  return { successes, errors, warnings, duplicates, tip };
}
