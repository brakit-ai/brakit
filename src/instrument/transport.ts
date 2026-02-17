import { request } from "node:http";
import type { TelemetryEvent, TelemetryBatch } from "../types.js";

const FLUSH_INTERVAL_MS = 50;
const FLUSH_BATCH_SIZE = 20;

const brakitPort = parseInt(process.env.BRAKIT_PORT ?? "0", 10);

let buffer: TelemetryEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (buffer.length === 0 || !brakitPort) return;
  const batch: TelemetryBatch = { _brakit: true, events: buffer };
  buffer = [];
  const body = JSON.stringify(batch);

  try {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: brakitPort,
        path: "/__brakit/api/ingest",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      // Discard response — fire and forget
      (res) => res.resume(),
    );
    req.on("error", () => {
      // Brakit server not ready yet or shutting down — silently drop
    });
    req.end(body);
  } catch {
    // Ignore transport failures
  }
}

function scheduleFlush(): void {
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
  if (timer && typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

export function send(event: TelemetryEvent): void {
  buffer.push(event);
  if (buffer.length >= FLUSH_BATCH_SIZE) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    flush();
  } else {
    scheduleFlush();
  }
}
