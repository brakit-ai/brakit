import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServiceRegistry } from "../../core/service-registry.js";
import type { TelemetryBatch, TelemetryEvent, TracedRequest, TracedQuery, TracedFetch, TracedLog, TracedError } from "../../types/index.js";
import type { SDKIngestPayload } from "../../types/api-contracts.js";
import { MAX_INGEST_BYTES } from "../../constants/limits.js";
import { HTTP_NO_CONTENT, HTTP_BAD_REQUEST, HTTP_METHOD_NOT_ALLOWED, HTTP_PAYLOAD_TOO_LARGE } from "../../constants/http.js";
import { TIMELINE_FETCH, TIMELINE_LOG, TIMELINE_ERROR, TIMELINE_QUERY } from "../../constants/timeline.js";
import { sendJson } from "./shared.js";
import { routeSDKEvent } from "./sdk-event-parser.js";

function isBrakitBatch(msg: unknown): msg is TelemetryBatch {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "_brakit" in msg &&
    (msg as TelemetryBatch)._brakit === true &&
    !("version" in msg)
  );
}

function isSDKPayload(msg: unknown): msg is SDKIngestPayload {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "_brakit" in msg &&
    "version" in msg &&
    typeof (msg as SDKIngestPayload).version === "number"
  );
}

export function createIngestHandler(
  registry: ServiceRegistry,
): (req: IncomingMessage, res: ServerResponse) => void {
  const routeEvent = (event: TelemetryEvent): void => {
    switch (event.type) {
      case TIMELINE_FETCH:
        registry.get("fetch-store").add(event.data);
        break;
      case TIMELINE_LOG:
        registry.get("log-store").add(event.data);
        break;
      case TIMELINE_ERROR:
        registry.get("error-store").add(event.data);
        break;
      case TIMELINE_QUERY:
        registry.get("query-store").add(event.data);
        break;
    }
  };

  const queryStore = registry.get("query-store");
  const fetchStore = registry.get("fetch-store");
  const logStore = registry.get("log-store");
  const errorStore = registry.get("error-store");
  const requestStore = registry.get("request-store");

  const stores = {
    addQuery: (data: Omit<TracedQuery, "id">) => queryStore.add(data),
    addFetch: (data: Omit<TracedFetch, "id">) => fetchStore.add(data),
    addLog: (data: Omit<TracedLog, "id">) => logStore.add(data),
    addError: (data: Omit<TracedError, "id">) => errorStore.add(data),
    addRequest: (data: TracedRequest) => requestStore.add(data),
  };

  return (req, res) => {
    if (req.method !== "POST") {
      sendJson(req, res, HTTP_METHOD_NOT_ALLOWED, { error: "Method not allowed" });
      return;
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;
    req.on("data", (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_INGEST_BYTES) {
        sendJson(req, res, HTTP_PAYLOAD_TOO_LARGE, { error: "Payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (res.headersSent) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());

        if (isSDKPayload(body)) {
          for (const event of body.events) {
            routeSDKEvent(event, stores);
          }
          res.writeHead(HTTP_NO_CONTENT);
          res.end();
          return;
        }

        if (isBrakitBatch(body)) {
          for (const event of body.events) {
            routeEvent(event);
          }
          res.writeHead(HTTP_NO_CONTENT);
          res.end();
          return;
        }

        sendJson(req, res, HTTP_BAD_REQUEST, { error: "Invalid batch" });
      } catch {
        sendJson(req, res, HTTP_BAD_REQUEST, { error: "Invalid JSON" });
      }
    });
    req.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(HTTP_BAD_REQUEST);
        res.end();
      }
    });
  };
}
