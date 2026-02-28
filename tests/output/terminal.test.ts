import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printBanner, createConsoleInsightListener } from "../../src/output/terminal.js";
import { makeInsight, makeAnalysisUpdate } from "../helpers/factories.js";

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

describe("createConsoleInsightListener", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let spy: any;

  beforeEach(() => {
    spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  function getOutput(): string {
    return spy.mock.calls.map((c: unknown[]) => c[0]).join("");
  }

  const metricsStore = { getEndpoint: vi.fn().mockReturnValue(undefined) } as any;

  it("prints warning and critical insights to stdout", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    listener(makeAnalysisUpdate([makeInsight({ severity: "warning", title: "Slow Endpoint" })]));
    const output = getOutput();
    expect(output).toContain("Slow Endpoint");
  });

  it("skips info-severity insights", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    listener(makeAnalysisUpdate([makeInsight({ severity: "info", title: "Info Insight" })]));
    expect(getOutput()).toBe("");
  });

  it("deduplicates same insight type and endpoint across calls", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    const insight = makeInsight();

    listener(makeAnalysisUpdate([insight]));
    const firstOutput = getOutput();
    expect(firstOutput).toContain("Slow Endpoint");

    spy.mockClear();
    listener(makeAnalysisUpdate([insight]));
    expect(getOutput()).toBe("");
  });

  it("prints nothing for empty insights array", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    listener(makeAnalysisUpdate([]));
    expect(getOutput()).toBe("");
  });
});
