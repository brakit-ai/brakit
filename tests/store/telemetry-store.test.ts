import { describe, it, expect, beforeEach, vi } from "vitest";
import { TelemetryStore } from "../../src/store/telemetry-store.js";
import type { TelemetryEntry } from "../../src/types/index.js";

interface TestEntry extends TelemetryEntry {
  value: string;
}

describe("TelemetryStore", () => {
  let store: TelemetryStore<TestEntry>;

  beforeEach(() => {
    store = new TelemetryStore<TestEntry>();
  });

  it("adds entries with auto-generated ids", () => {
    const entry = store.add({
      value: "hello",
      parentRequestId: null,
      timestamp: Date.now(),
    });
    expect(entry.id).toBeTypeOf("string");
    expect(entry.value).toBe("hello");
  });

  it("returns all entries via getAll", () => {
    store.add({ value: "a", parentRequestId: null, timestamp: 1 });
    store.add({ value: "b", parentRequestId: null, timestamp: 2 });
    const all = store.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].value).toBe("a");
    expect(all[1].value).toBe("b");
  });

  it("filters by parentRequestId via getByRequest", () => {
    store.add({ value: "a", parentRequestId: "req-1", timestamp: 1 });
    store.add({ value: "b", parentRequestId: "req-2", timestamp: 2 });
    store.add({ value: "c", parentRequestId: "req-1", timestamp: 3 });

    const filtered = store.getByRequest("req-1");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.value)).toEqual(["a", "c"]);
  });

  it("clears all entries", () => {
    store.add({ value: "a", parentRequestId: null, timestamp: 1 });
    store.add({ value: "b", parentRequestId: null, timestamp: 2 });
    store.clear();
    expect(store.getAll()).toHaveLength(0);
  });

  it("caps entries at maxEntries", () => {
    const small = new TelemetryStore<TestEntry>(3);
    small.add({ value: "a", parentRequestId: null, timestamp: 1 });
    small.add({ value: "b", parentRequestId: null, timestamp: 2 });
    small.add({ value: "c", parentRequestId: null, timestamp: 3 });
    small.add({ value: "d", parentRequestId: null, timestamp: 4 });

    const all = small.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].value).toBe("b");
    expect(all[2].value).toBe("d");
  });

  it("notifies listeners on add", () => {
    const listener = vi.fn();
    store.onEntry(listener);
    const entry = store.add({
      value: "test",
      parentRequestId: null,
      timestamp: 1,
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(entry);
  });

  it("removes listeners via offEntry", () => {
    const listener = vi.fn();
    store.onEntry(listener);
    store.offEntry(listener);
    store.add({ value: "test", parentRequestId: null, timestamp: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it("getByRequest returns empty array for unknown requestId", () => {
    store.add({ value: "a", parentRequestId: "req-1", timestamp: 1 });
    expect(store.getByRequest("unknown")).toEqual([]);
  });
});
