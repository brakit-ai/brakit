import type { IncomingMessage, ServerResponse } from "node:http";
import type { MetricsStore } from "../../store/index.js";
import { sendJson, requireGet } from "./shared.js";

export let metricsStoreRef: MetricsStore | null = null;

export function setMetricsStore(store: MetricsStore): void {
  metricsStoreRef = store;
}

export function handleApiMetrics(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!requireGet(req, res)) return;
  if (!metricsStoreRef) {
    sendJson(res, 200, { endpoints: [] });
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const endpoint = url.searchParams.get("endpoint");
  if (endpoint) {
    const ep = metricsStoreRef.getEndpoint(endpoint);
    sendJson(res, 200, { endpoints: ep ? [ep] : [] });
    return;
  }
  sendJson(res, 200, { endpoints: metricsStoreRef.getAll() });
}
