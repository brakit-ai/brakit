import type { Module } from "@swc/core";
import type { ExportInfo } from "../../../types/analysis.js";
import { getLineNumber } from "../parser.js";

export function extractExports(module: Module, source: string): ExportInfo[] {
  const exports: ExportInfo[] = [];

  for (const item of module.body) {
    switch (item.type) {
      case "ExportDeclaration":
        pushDeclarationExports(exports, item.declaration, source, item.span.start);
        break;

      case "ExportDefaultDeclaration":
        pushDefaultDeclExport(exports, item.decl, source, item.span.start);
        break;

      case "ExportDefaultExpression":
        exports.push({
          name: "default",
          isDefault: true,
          kind: "unknown",
          line: getLineNumber(source, item.span.start),
        });
        break;

      case "ExportNamedDeclaration":
        for (const spec of item.specifiers) {
          if (spec.type === "ExportSpecifier") {
            exports.push({
              name: getExportName(spec.exported ?? spec.orig),
              isDefault: false,
              kind: "unknown",
              line: getLineNumber(source, item.span.start),
            });
          }
        }
        break;
    }
  }

  return exports;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushDeclarationExports(exports: ExportInfo[], decl: any, source: string, offset: number): void {
  const line = getLineNumber(source, offset);

  switch (decl.type) {
    case "FunctionDeclaration":
      exports.push({ name: decl.identifier.value, isDefault: false, kind: "function", line });
      break;
    case "ClassDeclaration":
      exports.push({ name: decl.identifier.value, isDefault: false, kind: "class", line });
      break;
    case "VariableDeclaration":
      for (const declarator of decl.declarations) {
        if (declarator.id?.type === "Identifier") {
          exports.push({ name: declarator.id.value, isDefault: false, kind: "variable", line });
        }
      }
      break;
    case "TsTypeAliasDeclaration":
    case "TsInterfaceDeclaration":
      exports.push({ name: decl.id.value, isDefault: false, kind: "type", line });
      break;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushDefaultDeclExport(exports: ExportInfo[], decl: any, source: string, offset: number): void {
  const line = getLineNumber(source, offset);

  if (decl.type === "FunctionExpression") {
    exports.push({ name: decl.identifier?.value ?? "default", isDefault: true, kind: "function", line });
  } else if (decl.type === "ClassExpression") {
    exports.push({ name: decl.identifier?.value ?? "default", isDefault: true, kind: "class", line });
  } else {
    exports.push({ name: "default", isDefault: true, kind: "unknown", line });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getExportName(node: any): string {
  if (node.type === "Identifier") return node.value;
  if (node.type === "StringLiteral") return node.value;
  return "?";
}
