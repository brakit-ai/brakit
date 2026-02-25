import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { getEndpointKey } from "../../../utils/endpoint.js";
import { unwrapResponse } from "../../../utils/response.js";
import { INTERNAL_ID_SUFFIX } from "../../rules/patterns.js";
import {
  OVERFETCH_MIN_FIELDS,
  OVERFETCH_MIN_INTERNAL_IDS,
  OVERFETCH_NULL_RATIO,
  OVERFETCH_MANY_FIELDS,
} from "../../../constants/thresholds.js";

export const responseOverfetchRule: InsightRule = {
  id: "response-overfetch",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];
    const seen = new Set<string>();

    for (const r of ctx.nonStatic) {
      if (r.statusCode >= 400 || !r.responseBody) continue;
      const ep = getEndpointKey(r.method, r.path);
      if (seen.has(ep)) continue;

      let parsed: unknown;
      try { parsed = JSON.parse(r.responseBody); } catch { continue; }

      const target = unwrapResponse(parsed);
      const inspectObj = Array.isArray(target) && target.length > 0 ? target[0] : target;
      if (!inspectObj || typeof inspectObj !== "object" || Array.isArray(inspectObj)) continue;
      const fields = Object.keys(inspectObj as Record<string, unknown>);
      if (fields.length < OVERFETCH_MIN_FIELDS) continue;

      let internalIdCount = 0;
      let nullCount = 0;
      for (const key of fields) {
        if (INTERNAL_ID_SUFFIX.test(key) || key === "id" || key === "_id") internalIdCount++;
        const val = (inspectObj as Record<string, unknown>)[key];
        if (val === null || val === undefined) nullCount++;
      }

      const nullRatio = nullCount / fields.length;
      const reasons: string[] = [];
      if (internalIdCount >= OVERFETCH_MIN_INTERNAL_IDS) reasons.push(`${internalIdCount} internal ID fields`);
      if (nullRatio >= OVERFETCH_NULL_RATIO) reasons.push(`${Math.round(nullRatio * 100)}% null fields`);
      if (reasons.length === 0 && fields.length >= OVERFETCH_MANY_FIELDS) {
        reasons.push(`${fields.length} fields returned`);
      }

      if (reasons.length > 0) {
        seen.add(ep);
        insights.push({
          severity: "info",
          type: "response-overfetch",
          title: "Response Overfetch",
          desc: `${ep} — ${reasons.join(", ")}`,
          hint: "This response returns more data than the client likely needs. Use a DTO or select only required fields to reduce payload size and avoid leaking internal structure.",
          nav: "requests",
        });
      }
    }

    return insights;
  },
};
