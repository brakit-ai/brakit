import type { IncomingMessage, ServerResponse } from "node:http";
import type { Services } from "../../core/services.js";
import type { TelemetryBatch, TelemetryEvent, TracedRequest, TracedQuery, TracedFetch, TracedLog, TracedError } from "../../types/index.js";
import type { SDKIngestPayload } from "../../types/api-contracts.js";
import { MAX_INGEST_BYTES } from "../../constants/config.js";
import { HTTP_NO_CONTENT, HTTP_BAD_REQUEST, HTTP_METHOD_NOT_ALLOWED, HTTP_PAYLOAD_TOO_LARGE, TIMELINE_FETCH, TIMELINE_LOG, TIMELINE_ERROR, TIMELINE_QUERY } from "../../constants/labels.js";
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
  services: Services,
): (req: IncomingMessage, res: ServerResponse) => void {
  const routeEvent = (event: TelemetryEvent): void => {
    switch (event.type) {
      case TIMELINE_FETCH:
        services.fetchStore.add(event.data);
        break;
      case TIMELINE_LOG:
        services.logStore.add(event.data);
        break;
      case TIMELINE_ERROR:
        services.errorStore.add(event.data);
        break;
      case TIMELINE_QUERY:
        services.queryStore.add(event.data);
        break;
    }
  };

  const queryStore = services.queryStore;
  const fetchStore = services.fetchStore;
  const logStore = services.logStore;
  const errorStore = services.errorStore;
  const requestStore = services.requestStore;

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
