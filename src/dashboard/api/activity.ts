import type { IncomingMessage, ServerResponse } from "node:http";
import {
  defaultFetchStore,
  defaultLogStore,
  defaultErrorStore,
  defaultQueryStore,
} from "../../store/index.js";
import { sendJson, requireGet } from "./shared.js";

interface TimelineEvent {
  type: "fetch" | "log" | "error" | "query";
  timestamp: number;
  data: Record<string, unknown>;
}

export function handleApiActivity(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!requireGet(req, res)) return;

  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const requestId = url.searchParams.get("requestId");

    if (!requestId) {
      sendJson(res, 400, { error: "requestId parameter required" });
      return;
    }

    const fetches = defaultFetchStore.getByRequest(requestId);
    const logs = defaultLogStore.getByRequest(requestId);
    const errors = defaultErrorStore.getByRequest(requestId);
    const queries = defaultQueryStore.getByRequest(requestId);

    const timeline: TimelineEvent[] = [];

    for (const f of fetches)
      timeline.push({ type: "fetch", timestamp: f.timestamp, data: f as never });
    for (const l of logs)
      timeline.push({ type: "log", timestamp: l.timestamp, data: l as never });
    for (const e of errors)
      timeline.push({ type: "error", timestamp: e.timestamp, data: e as never });
    for (const q of queries)
      timeline.push({ type: "query", timestamp: q.timestamp, data: q as never });

    timeline.sort((a, b) => a.timestamp - b.timestamp);

    sendJson(res, 200, {
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
      sendJson(res, 500, { error: "Internal error" });
    }
  }
}
