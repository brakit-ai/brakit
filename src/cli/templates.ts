export const IMPORT_LINE = `import "brakit";`;
export const IMPORT_MARKER = "brakit";

/**
 * All string patterns that indicate a brakit import/require statement.
 * Used by install (detection) and uninstall (removal) commands.
 */
export const BRAKIT_IMPORT_PATTERNS = [
  'import("brakit")',
  'import "brakit"',
  "import 'brakit'",
  'require("brakit")',
  "require('brakit')",
] as const;

/** Returns true if content contains any brakit import/require pattern. */
export function containsBrakitImport(content: string): boolean {
  return BRAKIT_IMPORT_PATTERNS.some((p) => content.includes(p));
}

/** Filter out lines containing any brakit import/require pattern. */
export function removeBrakitImportLines(lines: string[]): string[] {
  return lines.filter(
    (line) => !BRAKIT_IMPORT_PATTERNS.some((p) => line.includes(p)),
  );
}

/**
 * Files that brakit creates during installation. Used by both install
 * (to know what to write) and uninstall (to know what to remove).
 */
export const CREATED_FILES = [
  "src/instrumentation.ts",
  "src/instrumentation.js",
  "instrumentation.ts",
  "instrumentation.js",
  "server/plugins/brakit.ts",
  "server/plugins/brakit.js",
] as const;

export const ENTRY_CANDIDATES = [
  "src/index.ts", "src/server.ts", "src/app.ts",
  "src/index.js", "src/server.js", "src/app.js",
  "server.ts", "app.ts", "index.ts",
  "server.js", "app.js", "index.js",
] as const;

/**
 * Exact file contents brakit writes for each framework. Used to determine
 * whether a file is purely brakit-generated (safe to delete entirely)
 * vs. user-modified (only remove brakit import lines).
 */
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
