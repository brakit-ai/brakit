import type { Module } from "@swc/core";

export function extractDirectives(module: Module): string[] {
  const directives: string[] = [];

  for (const item of module.body) {
    if (
      item.type === "ExpressionStatement" &&
      item.expression.type === "StringLiteral"
    ) {
      directives.push(item.expression.value);
    } else if (item.type !== "ImportDeclaration") {
      // Directives only appear before non-import statements.
      break;
    }
  }

  return directives;
}
