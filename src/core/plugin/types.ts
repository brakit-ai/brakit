import type { FileRole, FileAnalysis, ASTSummary } from "../types/analysis.js";
import type {
  Finding,
  CompoundFinding,
  Pillar,
  Severity,
  Confidence,
} from "../types/findings.js";

export interface BrakitPlugin {
  name: string;
  version: string;
  fileRoles?: Record<string, FileRoleRule>;
  patterns?: Record<string, AnalysisPattern>;
  compoundRules?: Record<string, CompoundRule>;
  scoring?: ScoringContribution;
}

export interface FileRoleRule {
  description: string;
  fileGlob: string;
  classify: (context: FileRoleContext) => FileRole[];
}

export interface FileRoleContext {
  filePath: string;
  relativePath: string;
  contents: string;
  extension: string;
  ast: ASTSummary;
}

export interface AnalysisPattern {
  description: string;
  fileGlob: string;
  pillar: Pillar;
  severity: Severity;
  confidence: Confidence;
  // patternId on returned findings is auto-prefixed with the plugin name.
  analyze: (context: PatternContext) => Finding[];
}

export interface PatternContext {
  filePath: string;
  relativePath: string;
  contents: string;
  extension: string;
  roles: FileRole[];
  fileAnalysis: FileAnalysis;
}

export interface CompoundRule {
  description: string;
  // Fully qualified pattern IDs, e.g., ['nextjs:unprotected-route', 'prisma:raw-query'].
  // Plugins reference each other by string ID, never by import.
  requires: string[];
  severity: Severity;
  correlate: (context: CompoundContext) => CompoundFinding[];
}

export interface CompoundContext {
  // Only patterns listed in `requires` are included.
  findingsByPattern: ReadonlyMap<string, Finding[]>;
  fileAnalyses: ReadonlyMap<string, FileAnalysis>;
  ruleId: string;
}

export interface ScoringContribution {
  category: string;
  // Weight in overall score, 0-1.
  weight: number;
}
