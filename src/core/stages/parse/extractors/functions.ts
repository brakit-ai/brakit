import type { Module } from "@swc/core";
import type { FunctionInfo } from "../../../types/analysis.js";
import { getLineNumber } from "../parser.js";

export function extractFunctions(module: Module, source: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  for (const item of module.body) {
    switch (item.type) {
      case "FunctionDeclaration":
        functions.push({
          name: item.identifier.value,
          params: extractParamNames(item.params),
          isAsync: item.async,
          isExported: false,
          line: getLineNumber(source, item.span.start),
        });
        break;

      case "VariableDeclaration":
        pushVariableFunctions(functions, item, false, source);
        break;

      case "ExportDeclaration":
        if (item.declaration.type === "FunctionDeclaration") {
          functions.push({
            name: item.declaration.identifier.value,
            params: extractParamNames(item.declaration.params),
            isAsync: item.declaration.async,
            isExported: true,
            line: getLineNumber(source, item.span.start),
          });
        } else if (item.declaration.type === "VariableDeclaration") {
          pushVariableFunctions(functions, item.declaration, true, source);
        }
        break;

      case "ExportDefaultDeclaration":
        if (item.decl.type === "FunctionExpression") {
          functions.push({
            name: item.decl.identifier?.value ?? null,
            params: extractParamNames(item.decl.params),
            isAsync: item.decl.async,
            isExported: true,
            line: getLineNumber(source, item.span.start),
          });
        }
        break;
    }
  }

  return functions;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushVariableFunctions(out: FunctionInfo[], decl: any, isExported: boolean, source: string): void {
  for (const declarator of decl.declarations) {
    const init = declarator.init;
    if (!init) continue;

    if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
      out.push({
        name: declarator.id?.type === "Identifier" ? declarator.id.value : null,
        params: extractParamNames(init.params),
        isAsync: init.async ?? false,
        isExported,
        line: getLineNumber(source, declarator.span.start),
      });
    }
  }
}

// Handles both Param[] (function decl) and Pattern[] (arrow function).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractParamNames(params: any[]): string[] {
  return params.map((p) => {
    const pat = p.pat ?? p;
    if (pat.type === "Identifier") return pat.value;
    if (pat.type === "AssignmentPattern" && pat.left?.type === "Identifier") {
      return pat.left.value;
    }
    if (pat.type === "ObjectPattern") return "{...}";
    if (pat.type === "ArrayPattern") return "[...]";
    if (pat.type === "RestElement") {
      return `...${pat.argument?.type === "Identifier" ? pat.argument.value : "args"}`;
    }
    return "?";
  });
}
