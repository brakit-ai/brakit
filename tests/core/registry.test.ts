import { describe, it, expect } from "vitest";
import { RegistryBuilder } from "@/core/plugin/registry";
import type { BrakitPlugin } from "@/core/plugin/types";
import {
  definePattern,
  defineFileRole,
  defineCompoundRule,
} from "@/core/plugin/helpers";

describe("RegistryBuilder", () => {
  it("qualifies IDs with plugin name prefix", () => {
    const plugin: BrakitPlugin = {
      name: "nextjs",
      version: "1.0.0",
      fileRoles: {
        "api-route": defineFileRole({
          fileGlob: "**/route.ts",
          classify: () => ["api-route"],
        }),
      },
      patterns: {
        "unprotected-route": definePattern({
          description: "Unprotected API route",
          fileGlob: "**/route.ts",
          pillar: "security",
          severity: "high",
          analyze: () => [],
        }),
      },
    };

    const registry = new RegistryBuilder().addPlugin(plugin).resolve();

    expect(registry.fileRoles.has("nextjs:api-route")).toBe(true);
    expect(registry.patterns.has("nextjs:unprotected-route")).toBe(true);
    expect(registry.plugins.has("nextjs")).toBe(true);
    expect(registry.warnings).toHaveLength(0);
  });

  it("throws on duplicate plugin name", () => {
    const builder = new RegistryBuilder();
    builder.addPlugin({ name: "test", version: "1.0.0" });

    expect(() => {
      builder.addPlugin({ name: "test", version: "2.0.0" });
    }).toThrow('Duplicate plugin: "test"');
  });

  it("includes compound rules when all requirements are met", () => {
    const nextjsPlugin: BrakitPlugin = {
      name: "nextjs",
      version: "1.0.0",
      patterns: {
        "unprotected-route": definePattern({
          description: "No auth check",
          fileGlob: "**/*.ts",
          pillar: "security",
          severity: "high",
          analyze: () => [],
        }),
      },
    };

    const prismaPlugin: BrakitPlugin = {
      name: "prisma",
      version: "1.0.0",
      patterns: {
        "raw-query": definePattern({
          description: "Raw SQL",
          fileGlob: "**/*.ts",
          pillar: "security",
          severity: "high",
          analyze: () => [],
        }),
      },
    };

    const compoundsPlugin: BrakitPlugin = {
      name: "compounds",
      version: "1.0.0",
      compoundRules: {
        "unprotected-raw-query": defineCompoundRule({
          description: "Unprotected route with raw query",
          requires: ["nextjs:unprotected-route", "prisma:raw-query"],
          severity: "critical",
          correlate: () => [],
        }),
      },
    };

    const registry = new RegistryBuilder()
      .addPlugin(nextjsPlugin)
      .addPlugin(prismaPlugin)
      .addPlugin(compoundsPlugin)
      .resolve();

    expect(
      registry.compoundRules.has("compounds:unprotected-raw-query"),
    ).toBe(true);
    expect(registry.warnings).toHaveLength(0);
  });

  it("skips compound rules with missing requirements and warns", () => {
    const nextjsPlugin: BrakitPlugin = {
      name: "nextjs",
      version: "1.0.0",
      patterns: {
        "unprotected-route": definePattern({
          description: "No auth check",
          fileGlob: "**/*.ts",
          pillar: "security",
          severity: "high",
          analyze: () => [],
        }),
      },
    };

    const compoundsPlugin: BrakitPlugin = {
      name: "compounds",
      version: "1.0.0",
      compoundRules: {
        "unprotected-raw-query": defineCompoundRule({
          description: "Missing prisma dependency",
          requires: ["nextjs:unprotected-route", "prisma:raw-query"],
          severity: "critical",
          correlate: () => [],
        }),
      },
    };

    const registry = new RegistryBuilder()
      .addPlugin(nextjsPlugin)
      .addPlugin(compoundsPlugin)
      .resolve();

    expect(
      registry.compoundRules.has("compounds:unprotected-raw-query"),
    ).toBe(false);
    expect(registry.warnings).toHaveLength(1);
    expect(registry.warnings[0]).toContain("prisma:raw-query");
  });

  it("merges capabilities from multiple plugins", () => {
    const plugin1: BrakitPlugin = {
      name: "nextjs",
      version: "1.0.0",
      patterns: {
        a: definePattern({
          description: "a",
          fileGlob: "**",
          pillar: "security",
          severity: "high",
          analyze: () => [],
        }),
      },
    };

    const plugin2: BrakitPlugin = {
      name: "prisma",
      version: "1.0.0",
      patterns: {
        b: definePattern({
          description: "b",
          fileGlob: "**",
          pillar: "security",
          severity: "high",
          analyze: () => [],
        }),
      },
    };

    const registry = new RegistryBuilder()
      .addPlugin(plugin1)
      .addPlugin(plugin2)
      .resolve();

    expect(registry.patterns.size).toBe(2);
    expect(registry.patterns.has("nextjs:a")).toBe(true);
    expect(registry.patterns.has("prisma:b")).toBe(true);
  });

  it("handles plugins with no capabilities", () => {
    const registry = new RegistryBuilder()
      .addPlugin({ name: "empty", version: "1.0.0" })
      .resolve();

    expect(registry.plugins.size).toBe(1);
    expect(registry.fileRoles.size).toBe(0);
    expect(registry.patterns.size).toBe(0);
    expect(registry.compoundRules.size).toBe(0);
  });

  it("supports chaining addPlugin calls", () => {
    const registry = new RegistryBuilder()
      .addPlugin({ name: "a", version: "1.0.0" })
      .addPlugin({ name: "b", version: "1.0.0" })
      .addPlugin({ name: "c", version: "1.0.0" })
      .resolve();

    expect(registry.plugins.size).toBe(3);
  });
});
