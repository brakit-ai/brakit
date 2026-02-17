import { randomUUID } from "node:crypto";
import type { TracedFetch } from "../types.js";
import { MAX_TELEMETRY_ENTRIES } from "../constants.js";

export type FetchListener = (entry: TracedFetch) => void;

export class FetchStore {
  private entries: TracedFetch[] = [];
  private listeners: FetchListener[] = [];

  constructor(private maxEntries = MAX_TELEMETRY_ENTRIES) {}

  add(data: Omit<TracedFetch, "id">): TracedFetch {
    const entry: TracedFetch = { id: randomUUID(), ...data };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    for (const fn of this.listeners) fn(entry);
    return entry;
  }

  getAll(): readonly TracedFetch[] {
    return this.entries;
  }

  getByRequest(requestId: string): TracedFetch[] {
    return this.entries.filter((e) => e.parentRequestId === requestId);
  }

  clear(): void {
    this.entries.length = 0;
  }

  onEntry(fn: FetchListener): void {
    this.listeners.push(fn);
  }

  offEntry(fn: FetchListener): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
}

export const defaultFetchStore = new FetchStore();
