import { describe, it, expect, vi } from "vitest";
import { AdapterRegistry } from "../../src/instrument/adapter-registry.js";
import type { BrakitAdapter } from "../../src/instrument/adapter.js";
import type { TelemetryEvent } from "../../src/types/index.js";

function makeAdapter(overrides: Partial<BrakitAdapter> = {}): BrakitAdapter {
  return {
    name: "test",
    detect: () => true,
    patch: vi.fn(),
    unpatch: vi.fn(),
    ...overrides,
  };
}

describe("AdapterRegistry", () => {
  it("patches adapters that detect successfully", () => {
    const registry = new AdapterRegistry();
    const adapter = makeAdapter({ name: "works" });
    registry.register(adapter);

    const emit = vi.fn();
    registry.patchAll(emit);

    expect(adapter.patch).toHaveBeenCalledWith(emit);
    expect(registry.getActive()).toHaveLength(1);
    expect(registry.getActive()[0].name).toBe("works");
  });

  it("skips adapters that do not detect", () => {
    const registry = new AdapterRegistry();
    const adapter = makeAdapter({ name: "missing", detect: () => false });
    registry.register(adapter);

    registry.patchAll(vi.fn());

    expect(adapter.patch).not.toHaveBeenCalled();
    expect(registry.getActive()).toHaveLength(0);
  });

  it("continues patching when one adapter's detect() throws", () => {
    const registry = new AdapterRegistry();
    const failing = makeAdapter({
      name: "failing",
      detect: () => { throw new Error("boom"); },
    });
    const working = makeAdapter({ name: "working" });

    registry.register(failing);
    registry.register(working);
    registry.patchAll(vi.fn());

    expect(working.patch).toHaveBeenCalled();
    expect(registry.getActive()).toHaveLength(1);
    expect(registry.getActive()[0].name).toBe("working");
  });

  it("continues patching when one adapter's patch() throws", () => {
    const registry = new AdapterRegistry();
    const failing = makeAdapter({
      name: "bad-patch",
      patch: () => { throw new Error("patch failed"); },
    });
    const working = makeAdapter({ name: "good-patch" });

    registry.register(failing);
    registry.register(working);
    registry.patchAll(vi.fn());

    expect(working.patch).toHaveBeenCalled();
    expect(registry.getActive()).toHaveLength(1);
  });

  it("unpatches all active adapters", () => {
    const registry = new AdapterRegistry();
    const a = makeAdapter({ name: "a" });
    const b = makeAdapter({ name: "b" });

    registry.register(a);
    registry.register(b);
    registry.patchAll(vi.fn());

    expect(registry.getActive()).toHaveLength(2);

    registry.unpatchAll();

    expect(a.unpatch).toHaveBeenCalled();
    expect(b.unpatch).toHaveBeenCalled();
    expect(registry.getActive()).toHaveLength(0);
  });

  it("continues unpatching when one adapter's unpatch() throws", () => {
    const registry = new AdapterRegistry();
    const failing = makeAdapter({
      name: "bad-unpatch",
      unpatch: () => { throw new Error("unpatch failed"); },
    });
    const working = makeAdapter({ name: "good-unpatch" });

    registry.register(failing);
    registry.register(working);
    registry.patchAll(vi.fn());

    registry.unpatchAll();

    expect(working.unpatch).toHaveBeenCalled();
    expect(registry.getActive()).toHaveLength(0);
  });

  it("handles adapters without unpatch method", () => {
    const registry = new AdapterRegistry();
    const adapter = makeAdapter({ name: "no-unpatch" });
    delete (adapter as Partial<BrakitAdapter>).unpatch;

    registry.register(adapter);
    registry.patchAll(vi.fn());

    // Should not throw
    expect(() => registry.unpatchAll()).not.toThrow();
    expect(registry.getActive()).toHaveLength(0);
  });

  it("passes emit function through to adapter patch", () => {
    const registry = new AdapterRegistry();
    const events: TelemetryEvent[] = [];
    const emit = (e: TelemetryEvent) => events.push(e);

    const adapter = makeAdapter({
      name: "emitter",
      patch: (emitFn) => {
        emitFn({ type: "query", data: { driver: "test", timestamp: 1 } as never });
      },
    });

    registry.register(adapter);
    registry.patchAll(emit);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("query");
  });
});
