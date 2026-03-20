import type { IncomingMessage, ServerResponse } from "node:http";
import { groupRequestsIntoFlows } from "../../analysis/group.js";
import { DEFAULT_API_LIMIT, MAX_API_LIMIT } from "../../constants/index.js";
import { HTTP_OK, HTTP_METHOD_NOT_ALLOWED } from "../../constants/labels.js";
import type { Services } from "../../core/services.js";
import { sendJson, requireGet, handleTelemetryGet, maskSensitiveHeaders, parseRequestUrl } from "./shared.js";
import type { TracedRequest } from "../../types/index.js";

function sanitizeRequest(r: TracedRequest): TracedRequest {
  return {
    ...r,
    headers: maskSensitiveHeaders(r.headers),
    responseHeaders: maskSensitiveHeaders(r.responseHeaders),
  };
}

export function createRequestsHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = parseRequestUrl(req);
    const method = url.searchParams.get("method");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const rawLimit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_API_LIMIT), 10);
    const limit = Math.min(Math.max(rawLimit || DEFAULT_API_LIMIT, 1), MAX_API_LIMIT);
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

    let results = [...services.requestStore.getAll()].reverse();

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
    sendJson(req, res, HTTP_OK, { total, requests: sanitized });
  };
}

export function createFlowsHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    const flows = groupRequestsIntoFlows(services.requestStore.getAll())
      .reverse()
      .map((flow) => ({
        ...flow,
        requests: flow.requests.map(sanitizeRequest),
      }));
    sendJson(req, res, HTTP_OK, { total: flows.length, flows });
  };
}

export function createClearHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (req.method !== "POST") {
      sendJson(req, res, HTTP_METHOD_NOT_ALLOWED, { error: "Method not allowed" });
      return;
    }
    services.requestStore.clear();
    services.fetchStore.clear();
    services.logStore.clear();
    services.errorStore.clear();
    services.queryStore.clear();
    services.metricsStore.reset();
    services.issueStore.clear();
    services.bus.emit("store:cleared", undefined);
    sendJson(req, res, HTTP_OK, { cleared: true });
  };
}

export function createFetchesHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, services.fetchStore);
}

export function createLogsHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, services.logStore);
}

export function createErrorsHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, services.errorStore);
}

export function createQueriesHandler(
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => handleTelemetryGet(req, res, services.queryStore);
}
