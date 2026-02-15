import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { detectProject } from "../../src/detect/project.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("detectProject", () => {
  it("detects a Next.js project", async () => {
    const result = await detectProject(resolve(FIXTURES, "nextjs"));
    expect(result.framework).toBe("nextjs");
    expect(result.devCommand).toBe("next dev");
    expect(result.devBin).toContain("node_modules");
    expect(result.devBin).toContain("next");
    expect(result.defaultPort).toBe(3000);
  });

  it("returns unknown for non-Next.js project", async () => {
    const result = await detectProject(resolve(FIXTURES, "unknown"));
    expect(result.framework).toBe("unknown");
    expect(result.devCommand).toBe("");
  });

  it("throws for missing package.json", async () => {
    await expect(
      detectProject(resolve(FIXTURES, "nonexistent")),
    ).rejects.toThrow();
  });

  it("detects npm package manager from lockfile", async () => {
    const result = await detectProject(resolve(FIXTURES, "nextjs"));
    expect(result.packageManager).toBe("npm");
  });

  it("returns unknown package manager when no lockfile exists", async () => {
    const result = await detectProject(resolve(FIXTURES, "unknown"));
    expect(result.packageManager).toBe("unknown");
  });
});
