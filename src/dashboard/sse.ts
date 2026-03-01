import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServiceRegistry } from "../core/service-registry.js";
import { SubscriptionBag } from "../core/disposable.js";
import { SSE_HEARTBEAT_INTERVAL_MS } from "../constants/index.js";

export function createSSEHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
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

    const bus = registry.get("event-bus");
    const subs = new SubscriptionBag();

    subs.add(bus.on("request:completed", (r) => writeEvent(null, JSON.stringify(r))));
    subs.add(bus.on("telemetry:fetch", (e) => writeEvent("fetch", JSON.stringify(e))));
    subs.add(bus.on("telemetry:log", (e) => writeEvent("log", JSON.stringify(e))));
    subs.add(bus.on("telemetry:error", (e) => writeEvent("error_event", JSON.stringify(e))));
    subs.add(bus.on("telemetry:query", (e) => writeEvent("query", JSON.stringify(e))));
    subs.add(bus.on("analysis:updated", ({ statefulInsights, statefulFindings }) => {
      writeEvent("insights", JSON.stringify(statefulInsights));
      writeEvent("security", JSON.stringify(statefulFindings));
    }));

    const heartbeat = setInterval(() => {
      if (res.destroyed) {
        clearInterval(heartbeat);
        return;
      }
      res.write(":heartbeat\n\n");
    }, SSE_HEARTBEAT_INTERVAL_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      subs.dispose();
    });
  };
}
