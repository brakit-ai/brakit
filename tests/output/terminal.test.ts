import { describe, it, expect, vi } from "vitest";
import { printBanner } from "../../src/output/terminal.js";

describe("printBanner", () => {
  it("prints proxy, target, and dashboard URLs", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    printBanner(3000, 3001);
    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("localhost:3000");
    expect(output).toContain("localhost:3001");
    expect(output).toContain("/__brakit");
    spy.mockRestore();
  });
});
