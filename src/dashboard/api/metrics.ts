import type { IncomingMessage, ServerResponse } from "node:http";
import type { MetricsStore } from "../../store/index.js";
import { sendJson, requireGet } from "./shared.js";

export function createMetricsHandler(
  metricsStore: MetricsStore,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    const url = new URL(req.url ?? "/", "http://localhost");
    const endpoint = url.searchParams.get("endpoint");
    if (endpoint) {
      const ep = metricsStore.getEndpoint(endpoint);
      sendJson(req, res, 200, { endpoints: ep ? [ep] : [] });
      return;
    }
    sendJson(req, res, 200, { endpoints: metricsStore.getAll() });
  };
}
