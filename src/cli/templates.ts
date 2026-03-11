export const IMPORT_LINE = `import "brakit";`;
export const IMPORT_MARKER = "brakit";

export const CREATED_FILES = [
  "src/instrumentation.ts",
  "instrumentation.ts",
  "server/plugins/brakit.ts",
] as const;

export const ENTRY_CANDIDATES = [
  "src/index.ts", "src/server.ts", "src/app.ts",
  "src/index.js", "src/server.js", "src/app.js",
  "server.ts", "app.ts", "index.ts",
  "server.js", "app.js", "index.js",
] as const;

export const BRAKIT_TEMPLATES = {
  nextjs: [
    `export async function register() {`,
    `  if (process.env.NODE_ENV !== "production") {`,
    `    try { await import("brakit"); } catch {}`,
    `  }`,
    `}`,
  ].join("\n"),

  nuxt: `import "brakit";`,
} as const;

const ALL_TEMPLATES: readonly string[] = Object.values(BRAKIT_TEMPLATES);

/**
 * Normalize content for comparison: trim each line, drop empty lines.
 */
function normalize(content: string): string {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Returns true if the file content is exactly one of the known brakit
 * templates (ignoring whitespace variations like trailing newlines,
 * indentation differences, etc.)
 */
export function isExactBrakitTemplate(fileContent: string): boolean {
  const normalizedFile = normalize(fileContent);
  if (!normalizedFile) return false;
  return ALL_TEMPLATES.some(
    (template) => normalize(template) === normalizedFile,
  );
}
