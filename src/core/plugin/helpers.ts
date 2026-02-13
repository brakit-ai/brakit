import type {
  FileRoleRule,
  AnalysisPattern,
  CompoundRule,
  FileRoleContext,
  PatternContext,
  CompoundContext,
} from "./types.js";
import type { FileRole } from "../types/analysis.js";
import type {
  Finding,
  CompoundFinding,
  Pillar,
  Severity,
  Confidence,
} from "../types/findings.js";

interface FileRoleInput {
  description?: string;
  fileGlob: string;
  classify: (context: FileRoleContext) => FileRole[];
}

export function defineFileRole(input: FileRoleInput): FileRoleRule {
  return {
    description: input.description ?? "",
    fileGlob: input.fileGlob,
    classify: input.classify,
  };
}

interface PatternInput {
  description: string;
  fileGlob: string;
  pillar: Pillar;
  severity: Severity;
  confidence?: Confidence;
  analyze: (context: PatternContext) => Finding[];
}

export function definePattern(input: PatternInput): AnalysisPattern {
  return {
    description: input.description,
    fileGlob: input.fileGlob,
    pillar: input.pillar,
    severity: input.severity,
    confidence: input.confidence ?? "firm",
    analyze: input.analyze,
  };
}

interface CompoundRuleInput {
  description: string;
  requires: string[];
  severity: Severity;
  correlate: (context: CompoundContext) => CompoundFinding[];
}

export function defineCompoundRule(input: CompoundRuleInput): CompoundRule {
  return {
    description: input.description,
    requires: input.requires,
    severity: input.severity,
    correlate: input.correlate,
  };
}
