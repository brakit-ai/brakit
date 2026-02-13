import { describe, it, expect } from "vitest";
import type { Finding, CompoundFinding } from "@/core/types/findings";
import type { FileAnalysis } from "@/core/types/analysis";
import type { BrakitScore } from "@/core/types/score";
import type { BrakitConfig } from "@/core/types/config";
import type { ProjectContext } from "@/core/types/context";
import type { BrakitPlugin } from "@/core/plugin/types";
import type { ScanInput, ScanResult } from "@/core/pipeline/types";
import { DEFAULT_CONFIG } from "@/core/types/config";
import {
  definePattern,
  defineFileRole,
  defineCompoundRule,
} from "@/core/plugin/helpers";

describe("Core types", () => {
  it("constructs a valid Finding", () => {
    const finding: Finding = {
      id: "nextjs:unprotected-route:abc123",
      patternId: "nextjs:unprotected-route",
      source: "nextjs",
      pillar: "security",
      severity: "high",
      confidence: "firm",
      title: "Unprotected API route",
      message: "API route has no authentication check",
      filePath: "app/api/users/route.ts",
      line: 5,
      metadata: {},
    };

    expect(finding.pillar).toBe("security");
    expect(finding.severity).toBe("high");
    expect(finding.confidence).toBe("firm");
  });

  it("constructs a valid CompoundFinding", () => {
    const finding: Finding = {
      id: "nextjs:unprotected-route:1",
      patternId: "nextjs:unprotected-route",
      source: "nextjs",
      pillar: "security",
      severity: "high",
      confidence: "firm",
      title: "Unprotected route",
      message: "No auth",
      filePath: "app/api/users/route.ts",
      metadata: {},
    };

    const compound: CompoundFinding = {
      id: "compound:unprotected-raw-query:abc",
      ruleId: "compounds:unprotected-raw-query",
      severity: "critical",
      confidence: "firm",
      message: "Unprotected route with raw SQL query",
      rationale: "Attacker can execute arbitrary SQL without authentication",
      constituentFindings: [finding],
      pillars: ["security", "reliability"],
    };

    expect(compound.constituentFindings).toHaveLength(1);
    expect(compound.pillars).toContain("security");
  });

  it("constructs a valid FileAnalysis", () => {
    const analysis: FileAnalysis = {
      filePath: "app/api/users/route.ts",
      roles: ["api-route"],
      classifiedBy: ["nextjs"],
      ast: {
        exports: [{ name: "GET", isDefault: false, kind: "function", line: 3 }],
        imports: [
          { source: "next/server", specifiers: ["NextResponse"], line: 1 },
        ],
        functions: [
          {
            name: "GET",
            params: ["request"],
            isAsync: true,
            isExported: true,
            line: 3,
          },
        ],
        directives: [],
      },
    };

    expect(analysis.roles).toContain("api-route");
    expect(analysis.ast.functions).toHaveLength(1);
  });

  it("has sensible DEFAULT_CONFIG", () => {
    expect(DEFAULT_CONFIG.minSeverity).toBe("low");
    expect(DEFAULT_CONFIG.exclude).toContain("**/node_modules/**");
    expect(DEFAULT_CONFIG.exclude).toContain("**/.next/**");
  });
});

describe("Plugin helpers", () => {
  it("defineFileRole fills defaults", () => {
    const rule = defineFileRole({
      fileGlob: "**/*.ts",
      classify: () => ["api-route"],
    });

    expect(rule.fileGlob).toBe("**/*.ts");
    expect(rule.description).toBe("");
    expect(rule.classify({} as any)).toEqual(["api-route"]);
  });

  it("definePattern fills confidence default", () => {
    const pattern = definePattern({
      description: "Test pattern",
      fileGlob: "**/*.ts",
      pillar: "security",
      severity: "high",
      analyze: () => [],
    });

    expect(pattern.confidence).toBe("firm");
    expect(pattern.pillar).toBe("security");
  });

  it("definePattern preserves explicit confidence", () => {
    const pattern = definePattern({
      description: "Certain pattern",
      fileGlob: "**/*.ts",
      pillar: "security",
      severity: "critical",
      confidence: "certain",
      analyze: () => [],
    });

    expect(pattern.confidence).toBe("certain");
  });

  it("defineCompoundRule constructs valid rule", () => {
    const rule = defineCompoundRule({
      description: "Test compound",
      requires: ["nextjs:unprotected-route", "prisma:raw-query"],
      severity: "critical",
      correlate: () => [],
    });

    expect(rule.requires).toHaveLength(2);
    expect(rule.severity).toBe("critical");
  });
});

describe("Pipeline types", () => {
  it("ScanResult extends Layer4Result with score and metadata", () => {
    // Verify the type structure compiles correctly by constructing a minimal ScanResult
    const result: ScanResult = {
      input: {
        rootDir: "/test",
        filePaths: ["app/api/users/route.ts"],
        fileContents: new Map([
          ["app/api/users/route.ts", "export async function GET() {}"],
        ]),
        config: {
          minSeverity: "low",
          exclude: [],
          pluginOptions: {},
          scoreThreshold: 0,
        },
        projectContext: {
          rootDir: "/test",
          framework: { name: "nextjs", version: "14.0.0", details: {} },
          orm: null,
          auth: null,
          baas: null,
          packageManager: "npm",
          typescript: true,
          dependencies: { next: "14.0.0" },
          devDependencies: {},
        },
      },
      fileAnalyses: [],
      fileAnalysisMap: new Map(),
      findings: [],
      compoundFindings: [],
      score: {
        overall: 100,
        pillars: {
          security: 100,
          reliability: 100,
          performance: 100,
          privacy: 100,
        },
        stats: {
          totalFiles: 1,
          filesAnalyzed: 1,
          totalFindings: 0,
          totalCompounds: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          byPillar: { security: 0, reliability: 0, performance: 0, privacy: 0 },
          byPlugin: {},
        },
      },
      metadata: {
        version: "0.1.0",
        startedAt: new Date().toISOString(),
        durationMs: 100,
        analyzersRun: ["custom-patterns"],
        analyzersSkipped: [],
      },
    };

    expect(result.score.overall).toBe(100);
    expect(result.findings).toHaveLength(0);
    expect(result.compoundFindings).toHaveLength(0);
  });
});
