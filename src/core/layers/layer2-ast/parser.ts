import { parseSync, type Module } from "@swc/core";

export function parseFile(filePath: string, source: string): Module | null {
  const syntax = getSyntax(filePath);
  if (!syntax) return null;

  try {
    return parseSync(source, {
      syntax,
      ...(syntax === "typescript"
        ? { tsx: filePath.endsWith(".tsx") }
        : { jsx: true }),
    });
  } catch {
    return null;
  }
}

function getSyntax(
  filePath: string,
): "typescript" | "ecmascript" | null {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    return "typescript";
  }
  if (
    filePath.endsWith(".js") ||
    filePath.endsWith(".jsx") ||
    filePath.endsWith(".mjs")
  ) {
    return "ecmascript";
  }
  return null;
}

export function getLineNumber(source: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}
