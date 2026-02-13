export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Confidence = "certain" | "firm" | "tentative";

export type Pillar = "security" | "reliability" | "performance" | "privacy";

export interface Finding {
  // Qualified as `plugin:pattern` by the engine, not the plugin author.
  id: string;
  patternId: string;
  source: string;

  pillar: Pillar;
  severity: Severity;
  confidence: Confidence;

  title: string;
  message: string;
  recommendation?: string;

  filePath: string;
  line?: number;
  column?: number;
  codeSnippet?: string;

  metadata: Record<string, unknown>;
}

export interface CompoundFinding {
  id: string;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  message: string;
  rationale: string;
  constituentFindings: Finding[];
  pillars: Pillar[];
}
