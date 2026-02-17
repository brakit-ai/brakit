/** Generic bounded in-memory store for telemetry entries with pub/sub support. */
import { randomUUID } from "node:crypto";
import type { TelemetryEntry } from "../types/index.js";
import { MAX_TELEMETRY_ENTRIES } from "../constants.js";

export type TelemetryListener<T> = (entry: T) => void;

/** Read-only view of a TelemetryStore — used by API handlers that only query data. */
export interface ReadonlyTelemetryStore {
  getAll(): readonly TelemetryEntry[];
  getByRequest(requestId: string): TelemetryEntry[];
}

export class TelemetryStore<T extends TelemetryEntry> implements ReadonlyTelemetryStore {
  private entries: T[] = [];
  private listeners: TelemetryListener<T>[] = [];

  constructor(private maxEntries = MAX_TELEMETRY_ENTRIES) {}

  add(data: Omit<T, "id">): T {
    const entry = { id: randomUUID(), ...data } as T;
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    for (const fn of this.listeners) fn(entry);
    return entry;
  }

  getAll(): readonly T[] {
    return this.entries;
  }

  getByRequest(requestId: string): T[] {
    return this.entries.filter((e) => e.parentRequestId === requestId);
  }

  clear(): void {
    this.entries.length = 0;
  }

  onEntry(fn: TelemetryListener<T>): void {
    this.listeners.push(fn);
  }

  offEntry(fn: TelemetryListener<T>): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
}
