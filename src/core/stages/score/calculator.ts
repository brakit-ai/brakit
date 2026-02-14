import type {
  Finding,
  CompoundFinding,
  Severity,
  Confidence,
  Pillar,
} from "../../types/findings.js";
import type { BrakitScore, ScoreStats } from "../../types/score.js";
import type { FileAnalysis } from "../../types/analysis.js";

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 15,
  high: 8,
  medium: 3,
  low: 1,
  info: 0,
};

const CONFIDENCE_MULT: Record<Confidence, number> = {
  certain: 1.0,
  firm: 0.8,
  tentative: 0.5,
};

const COMPOUND_MULT = 1.5;

const PILLAR_WEIGHTS: Record<Pillar, number> = {
  security: 0.35,
  reliability: 0.25,
  performance: 0.2,
  privacy: 0.2,
};

const ALL_PILLARS: Pillar[] = [
  "security",
  "reliability",
  "performance",
  "privacy",
];

const ALL_SEVERITIES: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateScore(
  findings: readonly Finding[],
  compoundFindings: readonly CompoundFinding[],
  fileAnalyses: readonly FileAnalysis[],
): BrakitScore {
  const pillarDeductions: Record<Pillar, number> = {
    security: 0,
    reliability: 0,
    performance: 0,
    privacy: 0,
  };

  for (const f of findings) {
    pillarDeductions[f.pillar] +=
      SEVERITY_WEIGHTS[f.severity] * CONFIDENCE_MULT[f.confidence];
  }

  for (const cf of compoundFindings) {
    const deduction =
      SEVERITY_WEIGHTS[cf.severity] *
      CONFIDENCE_MULT[cf.confidence] *
      COMPOUND_MULT;
    for (const pillar of cf.pillars) {
      pillarDeductions[pillar] += deduction;
    }
  }

  const pillars = {} as Record<Pillar, number>;
  let overall = 0;

  for (const pillar of ALL_PILLARS) {
    pillars[pillar] = clamp(
      Math.round(100 - pillarDeductions[pillar]),
      0,
      100,
    );
    overall += pillars[pillar] * PILLAR_WEIGHTS[pillar];
  }

  return {
    overall: Math.round(overall),
    pillars,
    stats: buildStats(findings, compoundFindings, fileAnalyses),
  };
}

function buildStats(
  findings: readonly Finding[],
  compoundFindings: readonly CompoundFinding[],
  fileAnalyses: readonly FileAnalysis[],
): ScoreStats {
  const bySeverity = Object.fromEntries(
    ALL_SEVERITIES.map((s) => [s, 0]),
  ) as Record<Severity, number>;
  const byPillar = Object.fromEntries(
    ALL_PILLARS.map((p) => [p, 0]),
  ) as Record<Pillar, number>;
  const byPlugin: Record<string, number> = {};

  for (const f of findings) {
    bySeverity[f.severity]++;
    byPillar[f.pillar]++;
    byPlugin[f.source] = (byPlugin[f.source] ?? 0) + 1;
  }

  return {
    totalFiles: fileAnalyses.length,
    filesAnalyzed: fileAnalyses.length,
    totalFindings: findings.length,
    totalCompounds: compoundFindings.length,
    bySeverity,
    byPillar,
    byPlugin,
  };
}
