import type { IncomingMessage, ServerResponse } from "node:http";
import type { Services } from "../core/services.js";
import { SSE_HEARTBEAT_INTERVAL_MS } from "../constants/index.js";
import { HTTP_OK, SSE_EVENT_FETCH, SSE_EVENT_LOG, SSE_EVENT_ERROR, SSE_EVENT_QUERY, SSE_EVENT_ISSUES } from "../constants/labels.js";
import { getCorsOrigin } from "./api/shared.js";

interface SSEClient {
  res: ServerResponse;
  heartbeat: ReturnType<typeof setInterval>;
}

export function createSSEHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  const clients = new Set<SSEClient>();

  function broadcast(eventType: string | null, data: string): void {
    if (clients.size === 0) return;
    const frame = eventType
      ? `event: ${eventType}\ndata: ${data}\n\n`
      : `data: ${data}\n\n`;
    for (const client of clients) {
      if (client.res.destroyed) {
        clients.delete(client);
        continue;
      }
      try {
        client.res.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  }

  const bus = services.bus;

  bus.on("request:completed", (r) => broadcast(null, JSON.stringify(r)));
  bus.on("telemetry:fetch", (e) => broadcast(SSE_EVENT_FETCH, JSON.stringify(e)));
  bus.on("telemetry:log", (e) => broadcast(SSE_EVENT_LOG, JSON.stringify(e)));
  bus.on("telemetry:error", (e) => broadcast(SSE_EVENT_ERROR, JSON.stringify(e)));
  bus.on("telemetry:query", (e) => broadcast(SSE_EVENT_QUERY, JSON.stringify(e)));
  bus.on("analysis:updated", ({ issues }) => {
    broadcast(SSE_EVENT_ISSUES, JSON.stringify(issues));
  });
  bus.on("issues:changed", (issues) => {
    broadcast(SSE_EVENT_ISSUES, JSON.stringify(issues));
  });

  return (req, res) => {
    const headers: Record<string, string> = {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    };
    const corsOrigin = getCorsOrigin(req);
    if (corsOrigin) {
      headers["access-control-allow-origin"] = corsOrigin;
    }
    res.writeHead(HTTP_OK, headers);

    res.write(":ok\n\n");

    const heartbeat = setInterval(() => {
      if (res.destroyed) {
        clearInterval(heartbeat);
        clients.delete(client);
        return;
      }
      try {
        res.write(":heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
        clients.delete(client);
      }
    }, SSE_HEARTBEAT_INTERVAL_MS);
    heartbeat.unref();

    const client: SSEClient = { res, heartbeat };
    clients.add(client);

    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(client);
    });
  };
}
