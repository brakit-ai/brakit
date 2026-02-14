import { describe, it, expect } from "vitest";
import { calculateScore } from "@/core/stages/score/calculator";
import type { Finding, CompoundFinding } from "@/core/types/findings";
import type { FileAnalysis } from "@/core/types/analysis";

const EMPTY_AST = { imports: [], exports: [], functions: [], directives: [] };

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "test:0",
    patternId: "test:pattern",
    source: "test",
    pillar: "security",
    severity: "high",
    confidence: "firm",
    title: "Test",
    message: "Test",
    filePath: "/test.ts",
    metadata: {},
    ...overrides,
  };
}

function makeCompound(overrides: Partial<CompoundFinding> = {}): CompoundFinding {
  return {
    id: "compound:0",
    ruleId: "test:compound",
    severity: "critical",
    confidence: "certain",
    message: "Compound issue",
    rationale: "Test rationale",
    constituentFindings: [],
    pillars: ["security"],
    ...overrides,
  };
}

const singleAnalysis: FileAnalysis[] = [
  { filePath: "/test.ts", roles: [], classifiedBy: [], ast: EMPTY_AST },
];

describe("calculateScore", () => {
  it("returns 100 for zero findings", () => {
    const score = calculateScore([], [], singleAnalysis);
    expect(score.overall).toBe(100);
    expect(score.pillars.security).toBe(100);
    expect(score.pillars.reliability).toBe(100);
    expect(score.pillars.performance).toBe(100);
    expect(score.pillars.privacy).toBe(100);
  });

  it("deducts for a single critical finding", () => {
    const findings = [makeFinding({ severity: "critical", confidence: "firm" })];
    const score = calculateScore(findings, [], singleAnalysis);
    // critical=15, firm=0.8 → deduction=12 → security=88
    expect(score.pillars.security).toBe(88);
    // overall = 88*0.35 + 100*0.25 + 100*0.20 + 100*0.20 = 30.8+25+20+20 = 95.8 → 96
    expect(score.overall).toBe(96);
  });

  it("deducts for a compound finding with 1.5x multiplier", () => {
    const compounds = [
      makeCompound({ severity: "critical", confidence: "certain" }),
    ];
    const score = calculateScore([], compounds, singleAnalysis);
    // critical=15, certain=1.0, compound=1.5 → deduction=22.5 → security=78 (round)
    expect(score.pillars.security).toBe(78);
  });

  it("applies confidence multipliers correctly", () => {
    const certain = [makeFinding({ severity: "high", confidence: "certain" })];
    const firm = [makeFinding({ severity: "high", confidence: "firm" })];
    const tentative = [makeFinding({ severity: "high", confidence: "tentative" })];

    const scoreCertain = calculateScore(certain, [], singleAnalysis);
    const scoreFirm = calculateScore(firm, [], singleAnalysis);
    const scoreTentative = calculateScore(tentative, [], singleAnalysis);

    // high=8: certain→8, firm→6.4, tentative→4
    expect(scoreCertain.pillars.security).toBe(92); // 100-8
    expect(scoreFirm.pillars.security).toBe(94); // 100-6.4 → 94 (round)
    expect(scoreTentative.pillars.security).toBe(96); // 100-4
  });

  it("never goes below 0", () => {
    const findings = Array.from({ length: 20 }, (_, i) =>
      makeFinding({ id: `f:${i}`, severity: "critical", confidence: "certain" }),
    );
    const score = calculateScore(findings, [], singleAnalysis);
    // 20 × 15 = 300 deduction → clamped to 0
    expect(score.pillars.security).toBe(0);
    expect(score.overall).toBeGreaterThanOrEqual(0);
  });

  it("distributes deductions across correct pillars", () => {
    const findings = [
      makeFinding({ pillar: "security", severity: "high", confidence: "firm" }),
      makeFinding({
        pillar: "performance",
        severity: "medium",
        confidence: "certain",
      }),
    ];
    const score = calculateScore(findings, [], singleAnalysis);
    // security: 100-6.4=94 (round), performance: 100-3=97
    expect(score.pillars.security).toBe(94);
    expect(score.pillars.performance).toBe(97);
    expect(score.pillars.reliability).toBe(100);
    expect(score.pillars.privacy).toBe(100);
  });

  it("calculates weighted overall correctly", () => {
    // Set each pillar to a known value via targeted findings
    const findings = [
      makeFinding({ pillar: "security", severity: "critical", confidence: "certain" }),
      makeFinding({ pillar: "reliability", severity: "high", confidence: "certain" }),
      makeFinding({ pillar: "performance", severity: "medium", confidence: "certain" }),
      makeFinding({ pillar: "privacy", severity: "low", confidence: "certain" }),
    ];
    const score = calculateScore(findings, [], singleAnalysis);
    // security: 100-15=85, reliability: 100-8=92, performance: 100-3=97, privacy: 100-1=99
    expect(score.pillars.security).toBe(85);
    expect(score.pillars.reliability).toBe(92);
    expect(score.pillars.performance).toBe(97);
    expect(score.pillars.privacy).toBe(99);
    // overall = 85*0.35 + 92*0.25 + 97*0.20 + 99*0.20 = 29.75+23+19.4+19.8 = 91.95 → 92
    expect(score.overall).toBe(92);
  });

  it("tracks stats correctly", () => {
    const analyses: FileAnalysis[] = [
      { filePath: "/a.ts", roles: [], classifiedBy: [], ast: EMPTY_AST },
      { filePath: "/b.ts", roles: [], classifiedBy: [], ast: EMPTY_AST },
      { filePath: "/c.ts", roles: [], classifiedBy: [], ast: EMPTY_AST },
    ];
    const findings = [
      makeFinding({ source: "nextjs", severity: "critical", pillar: "security" }),
      makeFinding({ source: "nextjs", severity: "high", pillar: "security" }),
      makeFinding({ source: "prisma", severity: "medium", pillar: "reliability" }),
    ];
    const compounds = [makeCompound()];

    const score = calculateScore(findings, compounds, analyses);

    expect(score.stats.totalFiles).toBe(3);
    expect(score.stats.filesAnalyzed).toBe(3);
    expect(score.stats.totalFindings).toBe(3);
    expect(score.stats.totalCompounds).toBe(1);
    expect(score.stats.bySeverity.critical).toBe(1);
    expect(score.stats.bySeverity.high).toBe(1);
    expect(score.stats.bySeverity.medium).toBe(1);
    expect(score.stats.byPillar.security).toBe(2);
    expect(score.stats.byPillar.reliability).toBe(1);
    expect(score.stats.byPlugin.nextjs).toBe(2);
    expect(score.stats.byPlugin.prisma).toBe(1);
  });

  it("compound finding pillars receive deductions", () => {
    const compounds = [
      makeCompound({
        severity: "high",
        confidence: "firm",
        pillars: ["security", "privacy"],
      }),
    ];
    const score = calculateScore([], compounds, singleAnalysis);
    // high=8, firm=0.8, compound=1.5 → deduction=9.6 → 100-9.6=90 (round)
    expect(score.pillars.security).toBe(90);
    expect(score.pillars.privacy).toBe(90);
    expect(score.pillars.reliability).toBe(100);
    expect(score.pillars.performance).toBe(100);
  });
});
