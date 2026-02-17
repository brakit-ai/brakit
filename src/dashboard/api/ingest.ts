import type { IncomingMessage, ServerResponse } from "node:http";
import {
  defaultFetchStore,
  defaultLogStore,
  defaultErrorStore,
  defaultQueryStore,
} from "../../store/index.js";
import type { TelemetryBatch, TelemetryEvent } from "../../types/index.js";
import { sendJson } from "./shared.js";

function isBrakitBatch(msg: unknown): msg is TelemetryBatch {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "_brakit" in msg &&
    (msg as TelemetryBatch)._brakit === true
  );
}

function routeEvent(event: TelemetryEvent): void {
  switch (event.type) {
    case "fetch":
      defaultFetchStore.add(event.data);
      break;
    case "log":
      defaultLogStore.add(event.data);
      break;
    case "error":
      defaultErrorStore.add(event.data);
      break;
    case "query":
      defaultQueryStore.add(event.data);
      break;
  }
}

export function handleApiIngest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (!isBrakitBatch(body)) {
        sendJson(res, 400, { error: "Invalid batch" });
        return;
      }
      for (const event of body.events) {
        routeEvent(event);
      }
      res.writeHead(204);
      res.end();
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
    }
  });
}
