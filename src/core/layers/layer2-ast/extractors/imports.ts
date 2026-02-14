import type { Module } from "@swc/core";
import type { ImportInfo } from "../../../types/analysis.js";
import { getLineNumber } from "../parser.js";

export function extractImports(module: Module, source: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  for (const item of module.body) {
    if (item.type !== "ImportDeclaration") continue;

    imports.push({
      source: item.source.value,
      specifiers: item.specifiers.map(getSpecifierName),
      line: getLineNumber(source, item.span.start),
    });
  }

  return imports;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpecifierName(spec: any): string {
  switch (spec.type) {
    case "ImportSpecifier":
      return spec.imported?.value ?? spec.local.value;
    case "ImportDefaultSpecifier":
      return "default";
    case "ImportNamespaceSpecifier":
      return "*";
    default:
      return "?";
  }
}
