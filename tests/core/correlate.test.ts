import { describe, it, expect } from "vitest";
import {
  resolveImport,
  parseTsconfigPaths,
} from "@/core/stages/correlate/import-resolver";
import { InMemoryImportGraph } from "@/core/stages/correlate/import-graph";
import { buildImportGraph } from "@/core/stages/correlate/graph-builder";
import { evaluateCompoundRules } from "@/core/stages/correlate/compound-evaluator";
import { RegistryBuilder } from "@/core/plugin/registry";
import { defineCompoundRule, definePattern } from "@/core/plugin/helpers";
import type { FileAnalysis } from "@/core/types/analysis";
import type { Finding } from "@/core/types/findings";

const STUB_PATTERN = definePattern({
  description: "stub",
  fileGlob: "**/*",
  pillar: "security",
  severity: "high",
  analyze: () => [],
});

// ── Import Resolver ──

describe("resolveImport", () => {
  const knownFiles = new Set([
    "/project/src/lib/db.ts",
    "/project/src/lib/auth.tsx",
    "/project/src/utils/index.ts",
    "/project/src/core/helpers.js",
  ]);

  it("resolves relative imports without extension", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "../lib/db",
      knownFiles,
      "/project",
    );
    expect(result).toBe("/project/src/lib/db.ts");
  });

  it("resolves relative imports with .js extension", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "../lib/db.js",
      knownFiles,
      "/project",
    );
    expect(result).toBe("/project/src/lib/db.ts");
  });

  it("resolves @/ alias imports", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "@/lib/db",
      knownFiles,
      "/project",
    );
    expect(result).toBe("/project/src/lib/db.ts");
  });

  it("resolves index files for directory imports", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "../utils",
      knownFiles,
      "/project",
    );
    expect(result).toBe("/project/src/utils/index.ts");
  });

  it("resolves .tsx files", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "../lib/auth",
      knownFiles,
      "/project",
    );
    expect(result).toBe("/project/src/lib/auth.tsx");
  });

  it("returns null for external packages", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "next/server",
      knownFiles,
      "/project",
    );
    expect(result).toBeNull();
  });

  it("returns null for non-existent files", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "../lib/missing",
      knownFiles,
      "/project",
    );
    expect(result).toBeNull();
  });

  it("returns null for bare package names", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "react",
      knownFiles,
      "/project",
    );
    expect(result).toBeNull();
  });

  it("resolves tsconfig path aliases", () => {
    const aliases = new Map([
      ["@lib/", "/project/src/lib/"],
      ["@/", "/project/src/"],
    ]);
    const result = resolveImport(
      "/project/src/app/route.ts",
      "@lib/db",
      knownFiles,
      "/project",
      aliases,
    );
    expect(result).toBe("/project/src/lib/db.ts");
  });

  it("longer alias prefix wins over shorter", () => {
    const files = new Set([
      "/project/src/components/ui/Button.tsx",
      "/project/src/components/ui/index.ts",
    ]);
    const aliases = new Map([
      ["@components/", "/project/src/components/"],
      ["@/", "/project/src/"],
    ]);
    const result = resolveImport(
      "/project/src/app/page.ts",
      "@components/ui/Button",
      files,
      "/project",
      aliases,
    );
    expect(result).toBe("/project/src/components/ui/Button.tsx");
  });

  it("returns null for scoped npm packages not in path aliases", () => {
    const aliases = new Map([["@/", "/project/src/"]]);
    const result = resolveImport(
      "/project/src/app/route.ts",
      "@prisma/client",
      knownFiles,
      "/project",
      aliases,
    );
    expect(result).toBeNull();
  });

  it("falls back to @/ → src/ when no path aliases provided", () => {
    const result = resolveImport(
      "/project/src/app/route.ts",
      "@/lib/db",
      knownFiles,
      "/project",
      undefined,
    );
    expect(result).toBe("/project/src/lib/db.ts");
  });
});

// ── parseTsconfigPaths ──

describe("parseTsconfigPaths", () => {
  it("parses wildcard path patterns", () => {
    const tsconfig = {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
          "@components/*": ["./src/components/*"],
        },
      },
    };
    const aliases = parseTsconfigPaths(tsconfig, "/project");
    expect(aliases.get("@/")).toBe("/project/src");
    expect(aliases.get("@components/")).toBe("/project/src/components");
  });

  it("sorts aliases by prefix length descending", () => {
    const tsconfig = {
      compilerOptions: {
        paths: {
          "@/*": ["./src/*"],
          "@components/*": ["./src/components/*"],
          "@lib/*": ["./src/lib/*"],
        },
      },
    };
    const aliases = parseTsconfigPaths(tsconfig, "/project");
    const keys = [...aliases.keys()];
    expect(keys[0]).toBe("@components/");
    expect(keys[1]).toBe("@lib/");
    expect(keys[2]).toBe("@/");
  });

  it("returns empty map when no paths configured", () => {
    const tsconfig = { compilerOptions: { strict: true } };
    const aliases = parseTsconfigPaths(tsconfig, "/project");
    expect(aliases.size).toBe(0);
  });

  it("respects baseUrl", () => {
    const tsconfig = {
      compilerOptions: {
        baseUrl: "src",
        paths: { "@lib/*": ["./lib/*"] },
      },
    };
    const aliases = parseTsconfigPaths(tsconfig, "/project");
    expect(aliases.get("@lib/")).toBe("/project/src/lib");
  });
});

// ── Import Graph ──

describe("InMemoryImportGraph", () => {
  function buildTestGraph() {
    const graph = new InMemoryImportGraph();
    // A → B → C
    graph.addEdge("/a.ts", "/b.ts");
    graph.addEdge("/b.ts", "/c.ts");
    // A → D (separate branch)
    graph.addEdge("/a.ts", "/d.ts");
    graph.freeze();
    return graph;
  }

  it("tracks forward imports", () => {
    const graph = buildTestGraph();
    expect(graph.importsOf("/a.ts")).toEqual(["/b.ts", "/d.ts"]);
    expect(graph.importsOf("/b.ts")).toEqual(["/c.ts"]);
  });

  it("tracks reverse imports", () => {
    const graph = buildTestGraph();
    expect(graph.importersOf("/b.ts")).toEqual(["/a.ts"]);
    expect(graph.importersOf("/c.ts")).toEqual(["/b.ts"]);
  });

  it("returns empty arrays for unknown files", () => {
    const graph = buildTestGraph();
    expect(graph.importsOf("/unknown.ts")).toEqual([]);
    expect(graph.importersOf("/unknown.ts")).toEqual([]);
  });

  it("areConnected returns true for same file", () => {
    const graph = buildTestGraph();
    expect(graph.areConnected("/a.ts", "/a.ts")).toBe(true);
  });

  it("areConnected finds direct imports (1 hop)", () => {
    const graph = buildTestGraph();
    expect(graph.areConnected("/a.ts", "/b.ts")).toBe(true);
    expect(graph.areConnected("/a.ts", "/d.ts")).toBe(true);
  });

  it("areConnected finds transitive imports (2 hops)", () => {
    const graph = buildTestGraph();
    expect(graph.areConnected("/a.ts", "/c.ts", 2)).toBe(true);
  });

  it("areConnected fails when hops exceed limit", () => {
    const graph = buildTestGraph();
    expect(graph.areConnected("/a.ts", "/c.ts", 1)).toBe(false);
  });

  it("areConnected returns false for unconnected files", () => {
    const graph = buildTestGraph();
    expect(graph.areConnected("/c.ts", "/d.ts")).toBe(false);
  });
});

// ── Graph Builder ──

describe("buildImportGraph", () => {
  it("builds graph from file analyses with AST imports", () => {
    const fileAnalyses: FileAnalysis[] = [
      {
        filePath: "/project/src/app/route.ts",
        roles: [],
        classifiedBy: [],
        ast: {
          imports: [{ source: "../lib/db", specifiers: [], line: 1 }],
          exports: [],
          functions: [],
          directives: [],
        },
      },
      {
        filePath: "/project/src/lib/db.ts",
        roles: [],
        classifiedBy: [],
        ast: { imports: [], exports: [], functions: [], directives: [] },
      },
    ];

    const graph = buildImportGraph(
      fileAnalyses,
      ["/project/src/app/route.ts", "/project/src/lib/db.ts"],
      "/project",
    );

    expect(graph.importsOf("/project/src/app/route.ts")).toEqual([
      "/project/src/lib/db.ts",
    ]);
    expect(graph.importersOf("/project/src/lib/db.ts")).toEqual([
      "/project/src/app/route.ts",
    ]);
  });

  it("skips external package imports", () => {
    const fileAnalyses: FileAnalysis[] = [
      {
        filePath: "/project/src/app/route.ts",
        roles: [],
        classifiedBy: [],
        ast: {
          imports: [
            { source: "next/server", specifiers: [], line: 1 },
            { source: "react", specifiers: [], line: 2 },
          ],
          exports: [],
          functions: [],
          directives: [],
        },
      },
    ];

    const graph = buildImportGraph(
      fileAnalyses,
      ["/project/src/app/route.ts"],
      "/project",
    );

    expect(graph.importsOf("/project/src/app/route.ts")).toEqual([]);
  });
});

// ── Compound Evaluator ──

describe("evaluateCompoundRules", () => {
  function makeFinding(
    overrides: Partial<Finding> & { patternId: string; filePath: string },
  ): Finding {
    return {
      id: "test:0",
      source: "test",
      pillar: "security",
      severity: "high",
      confidence: "firm",
      title: "Test finding",
      message: "Test message",
      metadata: {},
      ...overrides,
    };
  }

  it("evaluates compound rules when all required patterns have findings", () => {
    const findings: Finding[] = [
      makeFinding({
        patternId: "a:pattern-one",
        filePath: "/route.ts",
      }),
      makeFinding({
        patternId: "b:pattern-two",
        filePath: "/route.ts",
      }),
    ];

    const registry = new RegistryBuilder()
      .addPlugin({ name: "a", version: "0.1.0", patterns: { "pattern-one": STUB_PATTERN } })
      .addPlugin({ name: "b", version: "0.1.0", patterns: { "pattern-two": STUB_PATTERN } })
      .addPlugin({
        name: "test",
        version: "0.1.0",
        compoundRules: {
          "test-rule": defineCompoundRule({
            description: "Test compound",
            requires: ["a:pattern-one", "b:pattern-two"],
            severity: "critical",
            correlate: (ctx) => {
              const a = ctx.findingsByPattern.get("a:pattern-one")!;
              const b = ctx.findingsByPattern.get("b:pattern-two")!;
              return [
                {
                  id: "",
                  ruleId: ctx.ruleId,
                  severity: "critical",
                  confidence: "certain",
                  message: "Combined issue",
                  rationale: "Both found",
                  constituentFindings: [a[0], b[0]],
                  pillars: ["security"],
                },
              ];
            },
          }),
        },
      })
      .resolve();

    const graph = new InMemoryImportGraph();
    graph.freeze();

    const results = evaluateCompoundRules(
      findings,
      new Map(),
      graph,
      registry,
    );

    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("critical");
    expect(results[0].id).toBe("test:test-rule:0");
  });

  it("skips rules when required patterns have no findings", () => {
    const findings: Finding[] = [
      makeFinding({ patternId: "a:pattern-one", filePath: "/route.ts" }),
    ];

    const registry = new RegistryBuilder()
      .addPlugin({ name: "a", version: "0.1.0", patterns: { "pattern-one": STUB_PATTERN } })
      .addPlugin({ name: "b", version: "0.1.0", patterns: { "pattern-two": STUB_PATTERN } })
      .addPlugin({
        name: "test",
        version: "0.1.0",
        compoundRules: {
          "needs-both": defineCompoundRule({
            description: "Needs two patterns",
            requires: ["a:pattern-one", "b:pattern-two"],
            severity: "critical",
            correlate: () => [],
          }),
        },
      })
      .resolve();

    const graph = new InMemoryImportGraph();
    graph.freeze();

    const results = evaluateCompoundRules(
      findings,
      new Map(),
      graph,
      registry,
    );

    expect(results).toHaveLength(0);
  });

  it("assigns IDs to compound findings", () => {
    const findings: Finding[] = [
      makeFinding({ patternId: "x:p", filePath: "/a.ts" }),
    ];

    const registry = new RegistryBuilder()
      .addPlugin({ name: "x", version: "0.1.0", patterns: { p: STUB_PATTERN } })
      .addPlugin({
        name: "test",
        version: "0.1.0",
        compoundRules: {
          "id-test": defineCompoundRule({
            description: "ID assignment test",
            requires: ["x:p"],
            severity: "high",
            correlate: (ctx) => [
              {
                id: "",
                ruleId: ctx.ruleId,
                severity: "high",
                confidence: "firm",
                message: "First",
                rationale: "Test",
                constituentFindings: [],
                pillars: ["security"],
              },
              {
                id: "",
                ruleId: ctx.ruleId,
                severity: "high",
                confidence: "firm",
                message: "Second",
                rationale: "Test",
                constituentFindings: [],
                pillars: ["security"],
              },
            ],
          }),
        },
      })
      .resolve();

    const graph = new InMemoryImportGraph();
    graph.freeze();

    const results = evaluateCompoundRules(
      findings,
      new Map(),
      graph,
      registry,
    );

    expect(results[0].id).toBe("test:id-test:0");
    expect(results[1].id).toBe("test:id-test:1");
  });
});
