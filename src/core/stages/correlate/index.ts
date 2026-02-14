import type { AnalysisResult, CorrelationResult } from "../../pipeline/types.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";
import { buildImportGraph } from "./graph-builder.js";
import { evaluateCompoundRules } from "./compound-evaluator.js";

export function runCorrelator(
  analysisResult: AnalysisResult,
  registry: ResolvedRegistry,
): CorrelationResult {
  const importGraph = buildImportGraph(
    analysisResult.fileAnalyses,
    analysisResult.input.filePaths,
    analysisResult.input.rootDir,
  );

  const compoundFindings = evaluateCompoundRules(
    analysisResult.findings,
    analysisResult.fileAnalysisMap,
    importGraph,
    registry,
  );

  return {
    ...analysisResult,
    compoundFindings,
  };
}
