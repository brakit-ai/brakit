import type { IncomingMessage, ServerResponse } from "node:http";
import type { MetricsStore } from "../../store/index.js";
import { sendJson, requireGet } from "./shared.js";

export function createLiveMetricsHandler(
  metricsStore: MetricsStore,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    sendJson(req, res, 200, { endpoints: metricsStore.getLiveEndpoints() });
  };
}
