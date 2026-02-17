import type { IncomingMessage, ServerResponse } from "node:http";
import { onRequest, offRequest } from "../proxy/request-log.js";
import { defaultFetchStore } from "../store/fetch-store.js";
import { defaultLogStore } from "../store/log-store.js";
import { defaultErrorStore } from "../store/error-store.js";
import { defaultQueryStore } from "../store/query-store.js";
import type { TracedRequest, TracedFetch, TracedLog, TracedError, TracedQuery } from "../types.js";
import { SSE_HEARTBEAT_INTERVAL_MS } from "../constants.js";

export function handleSSE(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  });

  res.write(":ok\n\n");

  const writeEvent = (eventType: string | null, data: string) => {
    if (res.destroyed) return;
    if (eventType) {
      res.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } else {
      res.write(`data: ${data}\n\n`);
    }
  };

  const requestListener = (traced: TracedRequest) => {
    writeEvent(null, JSON.stringify(traced));
  };

  const fetchListener = (entry: TracedFetch) => {
    writeEvent("fetch", JSON.stringify(entry));
  };

  const logListener = (entry: TracedLog) => {
    writeEvent("log", JSON.stringify(entry));
  };

  const errorListener = (entry: TracedError) => {
    writeEvent("error_event", JSON.stringify(entry));
  };

  const queryListener = (entry: TracedQuery) => {
    writeEvent("query", JSON.stringify(entry));
  };

  onRequest(requestListener);
  defaultFetchStore.onEntry(fetchListener);
  defaultLogStore.onEntry(logListener);
  defaultErrorStore.onEntry(errorListener);
  defaultQueryStore.onEntry(queryListener);

  const heartbeat = setInterval(() => {
    if (res.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(":heartbeat\n\n");
  }, SSE_HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    offRequest(requestListener);
    defaultFetchStore.offEntry(fetchListener);
    defaultLogStore.offEntry(logListener);
    defaultErrorStore.offEntry(errorListener);
    defaultQueryStore.offEntry(queryListener);
  });
}
