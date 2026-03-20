import type { IncomingMessage, ServerResponse } from "node:http";
import type { MetricsStoreInterface } from "../../types/services.js";
import { sendJson, requireGet, parseRequestUrl } from "./shared.js";
import { HTTP_OK } from "../../constants/labels.js";

export function createMetricsHandler(
  metricsStore: MetricsStoreInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    const url = parseRequestUrl(req);
    const endpoint = url.searchParams.get("endpoint");
    if (endpoint) {
      const ep = metricsStore.getEndpoint(endpoint);
      sendJson(req, res, HTTP_OK, { endpoints: ep ? [ep] : [] });
      return;
    }
    sendJson(req, res, HTTP_OK, { endpoints: metricsStore.getAll() });
  };
}
