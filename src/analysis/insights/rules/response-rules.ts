import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";
import { getEndpointKey } from "../../../utils/endpoint.js";
import { unwrapResponse } from "../../../utils/response.js";
import { isErrorStatus } from "../../../utils/http-status.js";
import { formatSize } from "../../../utils/format.js";
import { INTERNAL_ID_SUFFIX } from "../../rules/patterns.js";
import { brakitDebug } from "../../../utils/log.js";
import { getErrorMessage } from "../../../utils/type-guards.js";
import {
  OVERFETCH_MIN_FIELDS,
  OVERFETCH_MIN_INTERNAL_IDS,
  OVERFETCH_NULL_RATIO,
  OVERFETCH_MANY_FIELDS,
  OVERFETCH_MIN_REQUESTS,
  LARGE_RESPONSE_BYTES,
} from "../../../constants/index.js";

export const responseOverfetchRule: InsightRule = {
  id: "response-overfetch",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];
    const seen = new Set<string>();

    for (const request of ctx.nonStatic) {
      if (isErrorStatus(request.statusCode) || !request.responseBody) continue;
      const endpointKey = getEndpointKey(request.method, request.path);
      if (seen.has(endpointKey)) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(request.responseBody);
      } catch (e) {
        brakitDebug(`json parse: ${getErrorMessage(e)}`);
        continue;
      }

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
        seen.add(endpointKey);
        insights.push({
          severity: "info",
          type: "response-overfetch",
          title: "Response Overfetch",
          desc: `${endpointKey} — ${reasons.join(", ")}`,
          hint: "This response returns more data than the client likely needs. Use a DTO or select only required fields to reduce payload size and avoid leaking internal structure.",
        });
      }
    }

    return insights;
  },
};

export const largeResponseRule: InsightRule = {
  id: "large-response",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const [endpointKey, group] of ctx.endpointGroups) {
      if (group.total < OVERFETCH_MIN_REQUESTS) continue;
      const avgSize = Math.round(group.totalSize / group.total);
      if (avgSize > LARGE_RESPONSE_BYTES) {
        insights.push({
          severity: "info",
          type: "large-response",
          title: "Large Response",
          desc: `${endpointKey} — avg ${formatSize(avgSize)} response`,
          hint: "Large API responses increase network transfer time. Implement pagination, field filtering, or response compression.",
        });
      }
    }

    return insights;
  },
};
