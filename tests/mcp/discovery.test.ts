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

describe("discoverBrakitPort", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws when port file does not exist", () => {
    expect(() => discoverBrakitPort(tmpDir)).toThrow("No port file found");
  });

  it("returns correct port and baseUrl when file exists", () => {
    const portDir = resolve(tmpDir, ".brakit");
    mkdirSync(portDir, { recursive: true });
    writeFileSync(resolve(portDir, "port"), "3456");

    const result = discoverBrakitPort(tmpDir);
    expect(result.port).toBe(3456);
    expect(result.baseUrl).toBe("http://localhost:3456");
  });

  it("trims whitespace from port file content", () => {
    const portDir = resolve(tmpDir, ".brakit");
    mkdirSync(portDir, { recursive: true });
    writeFileSync(resolve(portDir, "port"), "  7890\n  ");

    const result = discoverBrakitPort(tmpDir);
    expect(result.port).toBe(7890);
  });

  it("throws for invalid port (NaN)", () => {
    const portDir = resolve(tmpDir, ".brakit");
    mkdirSync(portDir, { recursive: true });
    writeFileSync(resolve(portDir, "port"), "notanumber");

    expect(() => discoverBrakitPort(tmpDir)).toThrow("Invalid port");
  });

  it("throws for port out of range", () => {
    const portDir = resolve(tmpDir, ".brakit");
    mkdirSync(portDir, { recursive: true });
    writeFileSync(resolve(portDir, "port"), "99999");

    expect(() => discoverBrakitPort(tmpDir)).toThrow("Invalid port");
  });

  it("throws for port 0", () => {
    const portDir = resolve(tmpDir, ".brakit");
    mkdirSync(portDir, { recursive: true });
    writeFileSync(resolve(portDir, "port"), "0");

    expect(() => discoverBrakitPort(tmpDir)).toThrow("Invalid port");
  });
});
