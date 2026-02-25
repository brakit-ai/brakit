import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequests, clearRequests } from "../../proxy/request-log.js";
import { groupRequestsIntoFlows } from "../../analysis/group.js";
import {
  defaultFetchStore,
  defaultLogStore,
  defaultErrorStore,
  defaultQueryStore,
} from "../../store/index.js";
import { DEFAULT_API_LIMIT } from "../../constants/index.js";
import type { MetricsStore } from "../../store/index.js";
import { sendJson, requireGet, handleTelemetryGet, maskSensitiveHeaders } from "./shared.js";
import type { TracedRequest } from "../../types/index.js";

export function handleApiRequests(
  req: IncomingMessage,
  res: ServerResponse,
): void {
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

  let results = [...getRequests()].reverse();

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
}

function sanitizeRequest(r: TracedRequest): TracedRequest {
  return {
    ...r,
    headers: maskSensitiveHeaders(r.headers),
    responseHeaders: maskSensitiveHeaders(r.responseHeaders),
  };
}

export function handleApiFlows(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!requireGet(req, res)) return;
  const flows = groupRequestsIntoFlows(getRequests()).reverse().map((flow) => ({
    ...flow,
    requests: flow.requests.map(sanitizeRequest),
  }));
  sendJson(req, res, 200, { total: flows.length, flows });
}

export function createClearHandler(
  metricsStore: MetricsStore,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (req.method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return;
    }
    clearRequests();
    defaultFetchStore.clear();
    defaultLogStore.clear();
    defaultErrorStore.clear();
    defaultQueryStore.clear();
    metricsStore.reset();
    sendJson(req, res, 200, { cleared: true });
  };
}

export function handleApiFetches(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  handleTelemetryGet(req, res, defaultFetchStore);
}

export function handleApiLogs(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  handleTelemetryGet(req, res, defaultLogStore);
}

export function handleApiErrors(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  handleTelemetryGet(req, res, defaultErrorStore);
}

export function handleApiQueries(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  handleTelemetryGet(req, res, defaultQueryStore);
}
