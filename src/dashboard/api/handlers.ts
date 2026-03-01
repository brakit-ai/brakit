import type { IncomingMessage, ServerResponse } from "node:http";
import { groupRequestsIntoFlows } from "../../analysis/group.js";
import { DEFAULT_API_LIMIT } from "../../constants/index.js";
import type { ServiceRegistry } from "../../core/service-registry.js";
import { sendJson, requireGet, handleTelemetryGet, maskSensitiveHeaders } from "./shared.js";
import type { TracedRequest } from "../../types/index.js";

function sanitizeRequest(r: TracedRequest): TracedRequest {
  return {
    ...r,
    headers: maskSensitiveHeaders(r.headers),
    responseHeaders: maskSensitiveHeaders(r.responseHeaders),
  };
}

export function createRequestsHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = new URL(req.url ?? "/", "http://localhost");
    const method = url.searchParams.get("method");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const limit = parseInt(
      url.searchParams.get("limit") ?? String(DEFAULT_API_LIMIT),
      10,
    );
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    let results = [...registry.get("request-store").getAll()].reverse();

    if (method) {
      results = results.filter((r) => r.method === method.toUpperCase());
    }

    if (status) {
      if (status.endsWith("xx")) {
        const prefix = parseInt(status[0], 10);
        results = results.filter(
          (r) => Math.floor(r.statusCode / 100) === prefix,
        );
      } else {
        const code = parseInt(status, 10);
        results = results.filter((r) => r.statusCode === code);
      }
    }

    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(
        (r) =>
          r.url.toLowerCase().includes(lower) ||
          r.requestBody?.toLowerCase().includes(lower) ||
          r.responseBody?.toLowerCase().includes(lower),
      );
    }

    const total = results.length;
    results = results.slice(offset, offset + limit);

    const sanitized = results.map(sanitizeRequest);
    sendJson(req, res, 200, { total, requests: sanitized });
  };
}

export function createFlowsHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    const flows = groupRequestsIntoFlows(registry.get("request-store").getAll())
      .reverse()
      .map((flow) => ({
        ...flow,
        requests: flow.requests.map(sanitizeRequest),
      }));
    sendJson(req, res, 200, { total: flows.length, flows });
  };
}

export function createClearHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (req.method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return;
    }
    registry.get("request-store").clear();
    registry.get("fetch-store").clear();
    registry.get("log-store").clear();
    registry.get("error-store").clear();
    registry.get("query-store").clear();
    registry.get("metrics-store").reset();
    if (registry.has("finding-store")) registry.get("finding-store").clear();
    registry.get("event-bus").emit("store:cleared", undefined as never);
    sendJson(req, res, 200, { cleared: true });
  };
}

export function createFetchesHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, registry.get("fetch-store"));
}

export function createLogsHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, registry.get("log-store"));
}

export function createErrorsHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, registry.get("error-store"));
}

export function createQueriesHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, registry.get("query-store"));
}
