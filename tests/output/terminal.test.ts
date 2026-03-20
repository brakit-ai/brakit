import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printBanner, startTerminalInsights } from "../../src/output/terminal.js";
import { makeInsight, makeStatefulIssue, makeAnalysisUpdate } from "../helpers/factories.js";
import { EventBus } from "../../src/core/event-bus.js";
import type { Services } from "../../src/core/services.js";

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
  let services: Services;

  beforeEach(() => {
    spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    bus = new EventBus();
    services = {
      bus,
      metricsStore: {
        getEndpoint: vi.fn().mockReturnValue(undefined),
        recordRequest: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        getLiveEndpoints: vi.fn().mockReturnValue([]),
        reset: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      },
    } as any;
  });

  afterEach(() => {
    spy.mockRestore();
  });

  function getOutput(): string {
    return spy.mock.calls.map((c: unknown[]) => c[0]).join("");
  }

  it("prints warning and critical issues to stdout", () => {
    const dispose = startTerminalInsights(services, 3000);
    const issues = [makeStatefulIssue({ severity: "warning", title: "Slow Endpoint" })];
    bus.emit("analysis:updated", makeAnalysisUpdate([makeInsight({ severity: "warning", title: "Slow Endpoint" })], [], issues));
    const output = getOutput();
    expect(output).toContain("Slow Endpoint");
    dispose();
  });

  it("skips info-severity issues", () => {
    const dispose = startTerminalInsights(services, 3000);
    const issues = [makeStatefulIssue({ severity: "info", title: "Info Issue", rule: "info-rule" })];
    bus.emit("analysis:updated", makeAnalysisUpdate([makeInsight({ severity: "info", title: "Info Issue" })], [], issues));
    expect(getOutput()).toBe("");
    dispose();
  });

  it("deduplicates same issue across calls", () => {
    const dispose = startTerminalInsights(services, 3000);
    const issues = [makeStatefulIssue()];
    const update = makeAnalysisUpdate([makeInsight()], [], issues);

    bus.emit("analysis:updated", update);
    const firstOutput = getOutput();
    expect(firstOutput).toContain("Slow Endpoint");

    spy.mockClear();
    bus.emit("analysis:updated", update);
    expect(getOutput()).toBe("");
    dispose();
  });

  it("prints nothing for empty issues array", () => {
    const dispose = startTerminalInsights(services, 3000);
    bus.emit("analysis:updated", makeAnalysisUpdate([], [], []));
    expect(getOutput()).toBe("");
    dispose();
  });
});
