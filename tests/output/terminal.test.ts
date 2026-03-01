import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printBanner, startTerminalInsights } from "../../src/output/terminal.js";
import { makeInsight, makeAnalysisUpdate } from "../helpers/factories.js";
import { EventBus } from "../../src/core/event-bus.js";
import { ServiceRegistry } from "../../src/core/service-registry.js";

describe("printBanner", () => {
  it("prints proxy, target, and dashboard URLs", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    printBanner(3000, 3001);
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("localhost:3000");
    expect(output).toContain("localhost:3001");
    expect(output).toContain("/__brakit");
    spy.mockRestore();
  });
});

describe("startTerminalInsights", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spy: any;
  let bus: EventBus;
  let registry: ServiceRegistry;

  beforeEach(() => {
    spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    bus = new EventBus();
    registry = new ServiceRegistry();
    registry.register("event-bus", bus);
    registry.register("metrics-store", {
      getEndpoint: vi.fn().mockReturnValue(undefined),
      recordRequest: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      getLiveEndpoints: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    } as any);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  function getOutput(): string {
    return spy.mock.calls.map((c: unknown[]) => c[0]).join("");
  }

  it("prints warning and critical insights to stdout", () => {
    const dispose = startTerminalInsights(registry, 3000);
    bus.emit("analysis:updated", makeAnalysisUpdate([makeInsight({ severity: "warning", title: "Slow Endpoint" })]));
    const output = getOutput();
    expect(output).toContain("Slow Endpoint");
    dispose();
  });

  it("skips info-severity insights", () => {
    const dispose = startTerminalInsights(registry, 3000);
    bus.emit("analysis:updated", makeAnalysisUpdate([makeInsight({ severity: "info", title: "Info Insight" })]));
    expect(getOutput()).toBe("");
    dispose();
  });

  it("deduplicates same insight type and endpoint across calls", () => {
    const dispose = startTerminalInsights(registry, 3000);
    const insight = makeInsight();

    bus.emit("analysis:updated", makeAnalysisUpdate([insight]));
    const firstOutput = getOutput();
    expect(firstOutput).toContain("Slow Endpoint");

    spy.mockClear();
    bus.emit("analysis:updated", makeAnalysisUpdate([insight]));
    expect(getOutput()).toBe("");
    dispose();
  });

  it("prints nothing for empty insights array", () => {
    const dispose = startTerminalInsights(registry, 3000);
    bus.emit("analysis:updated", makeAnalysisUpdate([]));
    expect(getOutput()).toBe("");
    dispose();
  });
});
