/** API handler for the LiveGraph dependency graph. */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Services } from "../../core/services.js";
import { HTTP_OK } from "../../constants/labels.js";
import { sendJson, requireGet, parseRequestUrl } from "./shared.js";

const VALID_LEVELS = new Set(["endpoints", "clusters"]);
const VALID_GROUPINGS = new Set(["path", "auth-boundary", "data-domain"]);
const MAX_PARAM_LENGTH = 200;

export function createGraphHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = parseRequestUrl(req);
    const rawCluster = url.searchParams.get("cluster") ?? undefined;
    const rawNode = url.searchParams.get("node") ?? undefined;
    const rawLevel = url.searchParams.get("level") ?? undefined;
    const rawGrouping = url.searchParams.get("grouping") ?? undefined;

    const cluster = rawCluster && rawCluster.length <= MAX_PARAM_LENGTH ? rawCluster : undefined;
    const node = rawNode && rawNode.length <= MAX_PARAM_LENGTH ? rawNode : undefined;
    const level = rawLevel && VALID_LEVELS.has(rawLevel) ? rawLevel : undefined;
    const grouping = rawGrouping && VALID_GROUPINGS.has(rawGrouping) ? rawGrouping : undefined;

    const { graphBuilder, metricsStore } = services;
    graphBuilder.enrichWithMetrics((endpointKey) => {
      const metrics = metricsStore.getEndpoint(endpointKey);
      if (!metrics || metrics.sessions.length === 0) return undefined;
      const latest = metrics.sessions[metrics.sessions.length - 1];
      return latest.p95DurationMs;
    });

    const data = graphBuilder.getApiResponse({ cluster, node, level, grouping });
    sendJson(req, res, HTTP_OK, data as unknown as Record<string, unknown>);
  };
}
