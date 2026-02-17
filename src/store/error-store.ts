import { randomUUID } from "node:crypto";
import type { TracedError } from "../types.js";
import { MAX_TELEMETRY_ENTRIES } from "../constants.js";

export type ErrorListener = (entry: TracedError) => void;

export class ErrorStore {
  private entries: TracedError[] = [];
  private listeners: ErrorListener[] = [];

  constructor(private maxEntries = MAX_TELEMETRY_ENTRIES) {}

  add(data: Omit<TracedError, "id">): TracedError {
    const entry: TracedError = { id: randomUUID(), ...data };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    for (const fn of this.listeners) fn(entry);
    return entry;
  }

  getAll(): readonly TracedError[] {
    return this.entries;
  }

  getByRequest(requestId: string): TracedError[] {
    return this.entries.filter((e) => e.parentRequestId === requestId);
  }

  clear(): void {
    this.entries.length = 0;
  }

  onEntry(fn: ErrorListener): void {
    this.listeners.push(fn);
  }

  offEntry(fn: ErrorListener): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
}

export const defaultErrorStore = new ErrorStore();
