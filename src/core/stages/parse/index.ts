import type { FileAnalysis, ASTSummary } from "../../types/analysis.js";
import type { ScanInput, ParseResult } from "../../pipeline/types.js";
import type { ResolvedRegistry } from "../../plugin/registry.js";
import { parseFile } from "./parser.js";
import { extractImports } from "./extractors/imports.js";
import { extractExports } from "./extractors/exports.js";
import { extractFunctions } from "./extractors/functions.js";
import { extractDirectives } from "./extractors/directives.js";
import { classifyFile } from "./role-classifier.js";

const EMPTY_AST: ASTSummary = {
  imports: [],
  exports: [],
  functions: [],
  directives: [],
};

export function runParser(
  input: ScanInput,
  registry: ResolvedRegistry,
): ParseResult {
  const fileAnalyses: FileAnalysis[] = [];
  const fileAnalysisMap = new Map<string, FileAnalysis>();

  for (const filePath of input.filePaths) {
    const contents = input.fileContents.get(filePath);
    if (contents === undefined) continue;

    const module = parseFile(filePath, contents);
    const ast: ASTSummary = module
      ? {
          imports: extractImports(module, contents),
          exports: extractExports(module, contents),
          functions: extractFunctions(module, contents),
          directives: extractDirectives(module),
        }
      : EMPTY_AST;

    const { roles, classifiedBy } = classifyFile(
      filePath,
      filePath,
      contents,
      ast,
      registry,
    );

    const analysis: FileAnalysis = { filePath, roles, classifiedBy, ast };
    fileAnalyses.push(analysis);
    fileAnalysisMap.set(filePath, analysis);
  }

  return { input, fileAnalyses, fileAnalysisMap };
}
