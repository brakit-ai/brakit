import { randomUUID } from "node:crypto";
import type { TracedQuery } from "../types.js";
import { MAX_TELEMETRY_ENTRIES } from "../constants.js";

export type QueryListener = (entry: TracedQuery) => void;

export class QueryStore {
  private entries: TracedQuery[] = [];
  private listeners: QueryListener[] = [];

  constructor(private maxEntries = MAX_TELEMETRY_ENTRIES) {}

  add(data: Omit<TracedQuery, "id">): TracedQuery {
    const entry: TracedQuery = { id: randomUUID(), ...data };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    for (const fn of this.listeners) fn(entry);
    return entry;
  }

  getAll(): readonly TracedQuery[] {
    return this.entries;
  }

  getByRequest(requestId: string): TracedQuery[] {
    return this.entries.filter((e) => e.parentRequestId === requestId);
  }

  clear(): void {
    this.entries.length = 0;
  }

  onEntry(fn: QueryListener): void {
    this.listeners.push(fn);
  }

  offEntry(fn: QueryListener): void {
    const idx = this.listeners.indexOf(fn);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
}

export const defaultQueryStore = new QueryStore();
