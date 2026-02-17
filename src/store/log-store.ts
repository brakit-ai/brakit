import { randomUUID } from "node:crypto";
import type { TracedLog } from "../types.js";
import { MAX_TELEMETRY_ENTRIES } from "../constants.js";

export type LogListener = (entry: TracedLog) => void;

export class LogStore {
  private entries: TracedLog[] = [];
  private listeners: LogListener[] = [];

  constructor(private maxEntries = MAX_TELEMETRY_ENTRIES) {}

  add(data: Omit<TracedLog, "id">): TracedLog {
    const entry: TracedLog = { id: randomUUID(), ...data };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    for (const fn of this.listeners) fn(entry);
    return entry;
  }

  getAll(): readonly TracedLog[] {
    return this.entries;
  }

  getByRequest(requestId: string): TracedLog[] {
    return this.entries.filter((e) => e.parentRequestId === requestId);
  }

  clear(): void {
    this.entries.length = 0;
  }

  onEntry(fn: LogListener): void {
    this.listeners.push(fn);
  }

  offEntry(fn: LogListener): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
}

export const defaultLogStore = new LogStore();
