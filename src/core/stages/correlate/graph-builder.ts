import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FileAnalysis } from "../../types/analysis.js";
import type { ImportGraph } from "./import-graph.js";
import { InMemoryImportGraph } from "./import-graph.js";
import { resolveImport, parseTsconfigPaths } from "./import-resolver.js";

export function buildImportGraph(
  fileAnalyses: readonly FileAnalysis[],
  filePaths: readonly string[],
  rootDir: string,
): ImportGraph {
  const knownFiles = new Set(filePaths);
  const pathAliases = loadPathAliases(rootDir);
  const graph = new InMemoryImportGraph();

  for (const analysis of fileAnalyses) {
    for (const imp of analysis.ast.imports) {
      const resolved = resolveImport(
        analysis.filePath,
        imp.source,
        knownFiles,
        rootDir,
        pathAliases,
      );
      if (resolved) {
        graph.addEdge(analysis.filePath, resolved);
      }
    }
  }

  graph.freeze();
  return graph;
}

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1");
}

function loadPathAliases(rootDir: string): Map<string, string> | undefined {
  try {
    const raw = readFileSync(join(rootDir, "tsconfig.json"), "utf-8");
    const tsconfig = JSON.parse(stripJsonComments(raw));
    const aliases = parseTsconfigPaths(tsconfig, rootDir);
    return aliases.size > 0 ? aliases : undefined;
  } catch {
    return undefined;
  }
}
