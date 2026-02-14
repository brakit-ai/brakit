import { extname } from "node:path";
import picomatch from "picomatch";
import type { Finding } from "../../types/findings.js";
import type { Layer2Result } from "../../pipeline/types.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";
import type { PatternContext } from "../../plugin/types.js";

export function runPatterns(
  layer2Result: Layer2Result,
  registry: ResolvedRegistry,
): Finding[] {
  const findings: Finding[] = [];
  let counter = 0;

  for (const [qualifiedId, pattern] of registry.patterns) {
    const pluginName = qualifiedId.split(":")[0];
    const matcher = picomatch(pattern.fileGlob);

    for (const analysis of layer2Result.fileAnalyses) {
      if (!matcher(analysis.filePath)) continue;

      const contents = layer2Result.input.fileContents.get(analysis.filePath);
      if (contents === undefined) continue;

      const ctx: PatternContext = {
        filePath: analysis.filePath,
        relativePath: analysis.filePath,
        contents,
        extension: extname(analysis.filePath),
        roles: analysis.roles,
        fileAnalysis: analysis,
      };

      const matches = pattern.analyze(ctx);

      for (const match of matches) {
        findings.push({
          id: `${qualifiedId}:${counter++}`,
          patternId: qualifiedId,
          source: pluginName,
          pillar: pattern.pillar,
          severity: match.severity ?? pattern.severity,
          confidence: match.confidence ?? pattern.confidence,
          title: match.title,
          message: match.message,
          recommendation: match.recommendation,
          filePath: analysis.filePath,
          line: match.line,
          column: match.column,
          codeSnippet: match.codeSnippet,
          metadata: match.metadata ?? {},
        });
      }
    }
  }

  return findings;
}
