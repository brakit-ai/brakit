import type { IncomingMessage, ServerResponse } from "node:http";
import {
  defaultFetchStore,
  defaultLogStore,
  defaultErrorStore,
  defaultQueryStore,
} from "../../store/index.js";
import type { TelemetryBatch, TelemetryEvent } from "../../types/index.js";
import type { NormalizedOp } from "../../types/index.js";
import { MAX_INGEST_BYTES } from "../../constants/limits.js";
import { sendJson } from "./shared.js";

// --- Internal batch format (from Node.js --import hooks) ---

function isBrakitBatch(msg: unknown): msg is TelemetryBatch {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "_brakit" in msg &&
    (msg as TelemetryBatch)._brakit === true &&
    !("version" in msg)
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

// --- SDK ingest format (from external language SDKs) ---

interface SDKIngestPayload {
  _brakit: true;
  version: number;
  sdk?: string;
  events: SDKEvent[];
}

interface SDKEvent {
  type: "db.query" | "fetch" | "log" | "error" | "auth.check";
  requestId?: string;
  timestamp: number;
  data: Record<string, unknown>;
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

function routeSDKEvent(event: SDKEvent): void {
  const ts = event.timestamp || Date.now();
  const parentRequestId = event.requestId ?? null;

  switch (event.type) {
    case "db.query":
      defaultQueryStore.add({
        driver: (event.data.source as string) ?? "sdk",
        source: (event.data.source as string) ?? "sdk",
        sql: event.data.sql as string | undefined,
        model: event.data.model as string | undefined,
        operation: event.data.operation as string | undefined,
        normalizedOp: (event.data.normalizedOp as NormalizedOp) ?? (event.data.operation as NormalizedOp) ?? "OTHER",
        table: (event.data.table as string) ?? "",
        durationMs: (event.data.duration as number) ?? (event.data.durationMs as number) ?? 0,
        rowCount: event.data.rowCount as number | undefined,
        parentRequestId,
        timestamp: ts,
      });
      break;
    case "fetch":
      defaultFetchStore.add({
        url: (event.data.url as string) ?? "",
        method: (event.data.method as string) ?? "GET",
        statusCode: (event.data.statusCode as number) ?? 0,
        durationMs: (event.data.duration as number) ?? (event.data.durationMs as number) ?? 0,
        parentRequestId,
        timestamp: ts,
      });
      break;
    case "log":
      defaultLogStore.add({
        level: (event.data.level as "log" | "warn" | "error" | "info" | "debug") ?? "log",
        message: (event.data.message as string) ?? "",
        parentRequestId,
        timestamp: ts,
      });
      break;
    case "error":
      defaultErrorStore.add({
        name: (event.data.name as string) ?? "Error",
        message: (event.data.message as string) ?? "",
        stack: (event.data.stack as string) ?? "",
        parentRequestId,
        timestamp: ts,
      });
      break;
    case "auth.check":
      // Auth events are captured as logs with a specific level for now.
      // Future: dedicated auth store.
      defaultLogStore.add({
        level: "info",
        message: `[auth] ${(event.data.provider as string) ?? "unknown"}: ${(event.data.result as string) ?? "check"}`,
        parentRequestId,
        timestamp: ts,
      });
      break;
  }
}

export function handleApiIngest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method !== "POST") {
    sendJson(req, res, 405, { error: "Method not allowed" });
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  req.on("data", (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_INGEST_BYTES) {
      sendJson(req, res, 413, { error: "Payload too large" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (totalSize > MAX_INGEST_BYTES) return;
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString());

      // SDK format (versioned)
      if (isSDKPayload(body)) {
        for (const event of body.events) {
          routeSDKEvent(event);
        }
        res.writeHead(204);
        res.end();
        return;
      }

      // Internal format (from Node.js hooks)
      if (isBrakitBatch(body)) {
        for (const event of body.events) {
          routeEvent(event);
        }
        res.writeHead(204);
        res.end();
        return;
      }

      sendJson(req, res, 400, { error: "Invalid batch" });
    } catch {
      sendJson(req, res, 400, { error: "Invalid JSON" });
    }
  });
}
