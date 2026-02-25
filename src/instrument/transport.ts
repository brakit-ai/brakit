import type { TelemetryEvent } from "../types/index.js";

type EventEmitter = (event: TelemetryEvent) => void;

let emitter: EventEmitter | null = null;

export function setEmitter(fn: EventEmitter): void {
  emitter = fn;
}

export function send(event: TelemetryEvent): void {
  emitter?.(event);
}
