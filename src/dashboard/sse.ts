import type { IncomingMessage, ServerResponse } from "node:http";
import { onRequest, offRequest } from "../proxy/request-log.js";
import type { TracedRequest } from "../types.js";
import { SSE_HEARTBEAT_INTERVAL_MS } from "../constants.js";

export function handleSSE(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*",
  });

  res.write(":ok\n\n");

  const listener = (traced: TracedRequest) => {
    if (res.destroyed) return;
    const data = JSON.stringify(traced);
    res.write(`data: ${data}\n\n`);
  };

  onRequest(listener);

  const heartbeat = setInterval(() => {
    if (res.destroyed) {
      clearInterval(heartbeat);
      return;
    }
    res.write(":heartbeat\n\n");
  }, SSE_HEARTBEAT_INTERVAL_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    offRequest(listener);
  });
}
