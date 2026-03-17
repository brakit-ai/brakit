import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServiceRegistry } from "../../core/service-registry.js";
import type { TimelineEvent } from "../../types/api-contracts.js";
import { sendJson, requireGet, parseRequestUrl } from "./shared.js";
import { HTTP_OK, HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR } from "../../constants/http.js";
import { TIMELINE_FETCH, TIMELINE_LOG, TIMELINE_ERROR, TIMELINE_QUERY } from "../../constants/timeline.js";
import { brakitDebug } from "../../utils/log.js";

export function createActivityHandler(
  registry: ServiceRegistry,
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

      const fetches = registry.get("fetch-store").getByRequest(requestId);
      const logs = registry.get("log-store").getByRequest(requestId);
      const errors = registry.get("error-store").getByRequest(requestId);
      const queries = registry.get("query-store").getByRequest(requestId);

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
