import type { IncomingMessage, ServerResponse } from "node:http";
import type { Services } from "../../core/services.js";
import type { TimelineEvent } from "../../types/api-contracts.js";
import { sendJson, requireGet, parseRequestUrl } from "./shared.js";
import { HTTP_OK, HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR, TIMELINE_FETCH, TIMELINE_LOG, TIMELINE_ERROR, TIMELINE_QUERY } from "../../constants/labels.js";
import { brakitDebug } from "../../utils/log.js";

export function createActivityHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    try {
      const url = parseRequestUrl(req);
      const requestId = url.searchParams.get("requestId");

      if (!requestId) {
        sendJson(req, res, HTTP_BAD_REQUEST, { error: "requestId parameter required" });
        return;
      }

      const fetches = services.fetchStore.getByRequest(requestId);
      const logs = services.logStore.getByRequest(requestId);
      const errors = services.errorStore.getByRequest(requestId);
      const queries = services.queryStore.getByRequest(requestId);

      const timeline: TimelineEvent[] = [];

      for (const f of fetches)
        timeline.push({ type: TIMELINE_FETCH, timestamp: f.timestamp, data: f });
      for (const l of logs)
        timeline.push({ type: TIMELINE_LOG, timestamp: l.timestamp, data: l });
      for (const e of errors)
        timeline.push({ type: TIMELINE_ERROR, timestamp: e.timestamp, data: e });
      for (const q of queries)
        timeline.push({ type: TIMELINE_QUERY, timestamp: q.timestamp, data: q });

      timeline.sort((a, b) => a.timestamp - b.timestamp);

      sendJson(req, res, HTTP_OK, {
        requestId,
        total: timeline.length,
        timeline,
        counts: {
          fetches: fetches.length,
          logs: logs.length,
          errors: errors.length,
          queries: queries.length,
        },
      });
    } catch (err) {
      brakitDebug(`activity handler error: ${err}`);
      if (!res.headersSent) {
        sendJson(req, res, HTTP_INTERNAL_ERROR, { error: "Internal error" });
      }
    }
  };
}
