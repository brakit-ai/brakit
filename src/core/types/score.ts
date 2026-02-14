import type { Pillar, Severity } from "./findings.js";

export interface BrakitScore {
  overall: number;
  pillars: Record<Pillar, number>;
  stats: ScoreStats;
}

export interface ScoreStats {
  totalFiles: number;
  filesAnalyzed: number;
  totalFindings: number;
  totalCompounds: number;
  bySeverity: Record<Severity, number>;
  byPillar: Record<Pillar, number>;
  byPlugin: Record<string, number>;
}
