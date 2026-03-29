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
        bus.emit("telemetry:fetch", event.data as TracedFetch);
        break;
      case TIMELINE_LOG:
        bus.emit("telemetry:log", event.data as TracedLog);
        break;
      case TIMELINE_ERROR:
        bus.emit("telemetry:error", event.data as TracedError);
        break;
      case TIMELINE_QUERY:
        bus.emit("telemetry:query", event.data as TracedQuery);
        break;
    }
  };

  const { bus, requestStore } = services;

  const stores = {
    addQuery: (data: Omit<TracedQuery, "id">) => bus.emit("telemetry:query", data as TracedQuery),
    addFetch: (data: Omit<TracedFetch, "id">) => bus.emit("telemetry:fetch", data as TracedFetch),
    addLog: (data: Omit<TracedLog, "id">) => bus.emit("telemetry:log", data as TracedLog),
    addError: (data: Omit<TracedError, "id">) => bus.emit("telemetry:error", data as TracedError),
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
