import type { AnalysisResult, ParseResult } from "../../pipeline/types.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";
import { runPatterns } from "./pattern-runner.js";
import { deduplicateFindings } from "./deduplicator.js";

export function runAnalyzer(
  parseResult: ParseResult,
  registry: ResolvedRegistry,
): AnalysisResult {
  const findings = runPatterns(parseResult, registry);
  const deduped = deduplicateFindings(findings);

  return {
    ...parseResult,
    findings: deduped,
  };
}
