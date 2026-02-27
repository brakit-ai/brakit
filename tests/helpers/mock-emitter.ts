import type { TelemetryEvent, TracedQuery, TracedFetch, TracedLog, TracedError } from "../../src/types/telemetry.js";

export interface MockEmitter {
  emit: (event: TelemetryEvent) => void;
  readonly events: TelemetryEvent[];
  readonly queries: Extract<TelemetryEvent, { type: "query" }>[];
  readonly fetches: Extract<TelemetryEvent, { type: "fetch" }>[];
  readonly logs: Extract<TelemetryEvent, { type: "log" }>[];
  readonly errors: Extract<TelemetryEvent, { type: "error" }>[];
  clear: () => void;
  lastEvent: () => TelemetryEvent | undefined;
  waitForEvents: (count: number, timeoutMs?: number) => Promise<TelemetryEvent[]>;
}

export function createMockEmitter(): MockEmitter {
  const events: TelemetryEvent[] = [];
  let resolveWaiter: ((events: TelemetryEvent[]) => void) | null = null;
  let targetCount = 0;

  const emit = (event: TelemetryEvent) => {
    events.push(event);
    if (resolveWaiter && events.length >= targetCount) {
      resolveWaiter(events.slice());
      resolveWaiter = null;
    }
  };

  return {
    emit,
    get events() { return events; },
    get queries() {
      return events.filter(
        (e): e is Extract<TelemetryEvent, { type: "query" }> => e.type === "query",
      );
    },
    get fetches() {
      return events.filter(
        (e): e is Extract<TelemetryEvent, { type: "fetch" }> => e.type === "fetch",
      );
    },
    get logs() {
      return events.filter(
        (e): e is Extract<TelemetryEvent, { type: "log" }> => e.type === "log",
      );
    },
    get errors() {
      return events.filter(
        (e): e is Extract<TelemetryEvent, { type: "error" }> => e.type === "error",
      );
    },
    clear() { events.length = 0; },
    lastEvent() { return events[events.length - 1]; },
    waitForEvents(count: number, timeoutMs = 5000) {
      if (events.length >= count) return Promise.resolve(events.slice());
      targetCount = count;
      return new Promise((resolve, reject) => {
        resolveWaiter = resolve;
        setTimeout(
          () => reject(new Error(`Timed out waiting for ${count} events, got ${events.length}`)),
          timeoutMs,
        );
      });
    },
  };
}
