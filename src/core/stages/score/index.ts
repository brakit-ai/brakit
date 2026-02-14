import type { CorrelationResult, ScanResult } from "../../pipeline/types.js";
import { calculateScore } from "./calculator.js";

export function runScorer(correlationResult: CorrelationResult): ScanResult {
  const score = calculateScore(
    correlationResult.findings,
    correlationResult.compoundFindings,
    correlationResult.fileAnalyses,
  );

  return {
    ...correlationResult,
    score,
    metadata: {
      version: "0.1.0",
      startedAt: new Date().toISOString(),
      durationMs: 0,
      analyzersRun: [],
      analyzersSkipped: [],
    },
  };
}
