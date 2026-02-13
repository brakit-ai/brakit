import type { Finding, CompoundFinding } from "../types/findings.js";
import type { FileAnalysis } from "../types/analysis.js";
import type { BrakitScore } from "../types/score.js";
import type { ScanConfig } from "../types/config.js";
import type { ProjectContext } from "../types/context.js";

export interface ScanInput {
  rootDir: string;
  filePaths: string[];
  fileContents: ReadonlyMap<string, string>;
  config: ScanConfig;
  projectContext: ProjectContext;
}

export interface Layer2Result {
  input: ScanInput;
  fileAnalyses: FileAnalysis[];
  fileAnalysisMap: ReadonlyMap<string, FileAnalysis>;
}

export interface Layer1Result extends Layer2Result {
  findings: Finding[];
}

export interface Layer4Result extends Layer1Result {
  compoundFindings: CompoundFinding[];
}

export interface ScanResult extends Layer4Result {
  score: BrakitScore;
  metadata: ScanMetadata;
}

export interface ScanMetadata {
  version: string;
  startedAt: string;
  durationMs: number;
  analyzersRun: string[];
  analyzersSkipped: { name: string; reason: string }[];
}
