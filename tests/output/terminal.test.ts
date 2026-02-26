import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printBanner, createConsoleInsightListener } from "../../src/output/terminal.js";
import type { Insight } from "../../src/analysis/insights.js";

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
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  function getOutput(): string {
    return spy.mock.calls.map((c) => c[0]).join("");
  }

  function makeInsight(overrides: Partial<Insight> = {}): Insight {
    return {
      severity: "warning",
      type: "slow",
      title: "Slow Endpoint",
      desc: "GET /api/users — avg 2.1s",
      hint: "Check queries",
      ...overrides,
    };
  }

  const metricsStore = { getEndpoint: vi.fn().mockReturnValue(undefined) } as any;

  it("prints warning and critical insights to stdout", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    listener(
      [makeInsight({ severity: "warning", title: "Slow Endpoint" })],
      [],
    );
    const output = getOutput();
    expect(output).toContain("Slow Endpoint");
  });

  it("skips info-severity insights", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    listener(
      [makeInsight({ severity: "info", title: "Info Insight" })],
      [],
    );
    expect(getOutput()).toBe("");
  });

  it("deduplicates same insight type and endpoint across calls", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    const insight = makeInsight();

    listener([insight], []);
    const firstOutput = getOutput();
    expect(firstOutput).toContain("Slow Endpoint");

    spy.mockClear();
    listener([insight], []);
    expect(getOutput()).toBe("");
  });

  it("prints nothing for empty insights array", () => {
    const listener = createConsoleInsightListener(3000, metricsStore);
    listener([], []);
    expect(getOutput()).toBe("");
  });
});
