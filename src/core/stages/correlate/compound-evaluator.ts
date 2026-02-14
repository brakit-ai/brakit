import type { Finding, CompoundFinding } from "../../types/findings.js";
import type { FileAnalysis } from "../../types/analysis.js";
import type { CompoundContext } from "../../plugin/types.js";
import type { ImportGraph } from "./import-graph.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";

export function evaluateCompoundRules(
  findings: Finding[],
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  importGraph: ImportGraph,
  registry: ResolvedRegistry,
): CompoundFinding[] {
  const results: CompoundFinding[] = [];
  let counter = 0;

  for (const [ruleId, rule] of registry.compoundRules) {
    const findingsByPattern = new Map<string, Finding[]>();

    for (const patternId of rule.requires) {
      const matches = findings.filter((f) => f.patternId === patternId);
      if (matches.length > 0) {
        findingsByPattern.set(patternId, matches);
      }
    }

    if (findingsByPattern.size < rule.requires.length) continue;

    const context: CompoundContext = {
      findingsByPattern,
      fileAnalyses,
      importGraph,
      ruleId,
    };

    const compounds = rule.correlate(context);

    for (const cf of compounds) {
      results.push({
        ...cf,
        id: cf.id || `${ruleId}:${counter++}`,
      });
    }
  }

  return results;
}
