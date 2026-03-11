import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { discoverBrakitPort } from "../../src/mcp/discovery.js";

function makeTmpDir(): string {
  const dir = resolve(tmpdir(), `brakit-disc-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writePort(dir: string, port: string): void {
  const portDir = resolve(dir, ".brakit");
  mkdirSync(portDir, { recursive: true });
  writeFileSync(resolve(portDir, "port"), port);
}

describe("discoverBrakitPort", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when no port file exists anywhere in the tree", async () => {
    await expect(discoverBrakitPort(tmpDir)).rejects.toThrow("not running");
  });

  it("returns correct port and baseUrl when file exists in cwd", async () => {
    writePort(tmpDir, "3456");

    const result = await discoverBrakitPort(tmpDir);
    expect(result.port).toBe(3456);
    expect(result.baseUrl).toBe("http://localhost:3456");
  });

  it("finds port file in a child directory", async () => {
    const child = resolve(tmpDir, "my-app");
    mkdirSync(child, { recursive: true });
    writePort(child, "4000");

    const result = await discoverBrakitPort(tmpDir);
    expect(result.port).toBe(4000);
  });

  it("finds port file in a child directory when starting from monorepo root", async () => {
    const monorepoRoot = resolve(tmpDir, "monorepo");
    const frontend = resolve(monorepoRoot, "frontend");
    mkdirSync(frontend, { recursive: true });
    writePort(frontend, "5000");

    // MCP starts at monorepo root — should find the sub-project's port
    const result = await discoverBrakitPort(monorepoRoot);
    expect(result.port).toBe(5000);
  });

  it("finds port in a sibling project via parent walk-up", async () => {
    const parent = resolve(tmpDir, "projects");
    const projectA = resolve(parent, "frontend");
    const projectB = resolve(parent, "backend");
    mkdirSync(projectA, { recursive: true });
    mkdirSync(projectB, { recursive: true });
    writePort(projectB, "5000");

    // Starting from projectA should find projectB's port via parent scan
    const result = await discoverBrakitPort(projectA);
    expect(result.port).toBe(5000);
  });

  it("finds port file by walking up the directory tree", async () => {
    writePort(tmpDir, "6000");
    const nested = resolve(tmpDir, "src", "components");
    mkdirSync(nested, { recursive: true });

    const result = await discoverBrakitPort(nested);
    expect(result.port).toBe(6000);
  });

  it("trims whitespace from port file content", async () => {
    writePort(tmpDir, "  7890\n  ");

    const result = await discoverBrakitPort(tmpDir);
    expect(result.port).toBe(7890);
  });

  it("throws for invalid port (NaN)", async () => {
    writePort(tmpDir, "notanumber");
    await expect(discoverBrakitPort(tmpDir)).rejects.toThrow("not running");
  });

  it("throws for port out of range", async () => {
    writePort(tmpDir, "99999");
    await expect(discoverBrakitPort(tmpDir)).rejects.toThrow("not running");
  });

  it("throws for port 0", async () => {
    writePort(tmpDir, "0");
    await expect(discoverBrakitPort(tmpDir)).rejects.toThrow("not running");
  });
});
