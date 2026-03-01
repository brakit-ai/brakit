import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServiceRegistry } from "../../core/service-registry.js";
import type { TimelineEvent } from "../../types/api-contracts.js";
import { sendJson, requireGet } from "./shared.js";

export function createActivityHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const requestId = url.searchParams.get("requestId");

      if (!requestId) {
        sendJson(req, res, 400, { error: "requestId parameter required" });
        return;
      }

      const fetches = registry.get("fetch-store").getByRequest(requestId);
      const logs = registry.get("log-store").getByRequest(requestId);
      const errors = registry.get("error-store").getByRequest(requestId);
      const queries = registry.get("query-store").getByRequest(requestId);

      const timeline: TimelineEvent[] = [];

      for (const f of fetches)
        timeline.push({ type: "fetch", timestamp: f.timestamp, data: { ...f } });
      for (const l of logs)
        timeline.push({ type: "log", timestamp: l.timestamp, data: { ...l } });
      for (const e of errors)
        timeline.push({ type: "error", timestamp: e.timestamp, data: { ...e } });
      for (const q of queries)
        timeline.push({ type: "query", timestamp: q.timestamp, data: { ...q } });

      timeline.sort((a, b) => a.timestamp - b.timestamp);

      sendJson(req, res, 200, {
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
      console.error("[brakit] activity handler error:", err);
      if (!res.headersSent) {
        sendJson(req, res, 500, { error: "Internal error" });
      }
    }
  };
}
