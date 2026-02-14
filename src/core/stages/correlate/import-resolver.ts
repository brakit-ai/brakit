import { resolve, dirname } from "node:path";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const INDEX_FILES = EXTENSIONS.map((ext) => `/index${ext}`);

export function resolveImport(
  fromFile: string,
  specifier: string,
  knownFiles: ReadonlySet<string>,
  rootDir: string,
  pathAliases?: ReadonlyMap<string, string>,
): string | null {
  // Relative imports: ./foo, ../bar
  if (specifier.startsWith(".")) {
    return tryResolve(resolve(dirname(fromFile), specifier), knownFiles);
  }

  // Check tsconfig path aliases (sorted longest-prefix-first)
  if (pathAliases) {
    for (const [prefix, targetDir] of pathAliases) {
      if (specifier.startsWith(prefix)) {
        const rest = specifier.slice(prefix.length);
        return tryResolve(resolve(targetDir, rest), knownFiles);
      }
    }
  }

  // Fallback: @/ → src/ (Next.js convention, for projects without tsconfig paths)
  if (specifier.startsWith("@/")) {
    return tryResolve(resolve(rootDir, "src", specifier.slice(2)), knownFiles);
  }

  // No match → external package
  return null;
}

function tryResolve(
  base: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  const stripped = base.replace(/\.[jt]sx?$/, "");

  for (const ext of EXTENSIONS) {
    if (knownFiles.has(stripped + ext)) return stripped + ext;
  }
  for (const idx of INDEX_FILES) {
    if (knownFiles.has(stripped + idx)) return stripped + idx;
  }

  return null;
}

export function parseTsconfigPaths(
  tsconfig: Record<string, unknown>,
  rootDir: string,
): Map<string, string> {
  const aliases = new Map<string, string>();
  const compilerOptions = tsconfig.compilerOptions as
    | Record<string, unknown>
    | undefined;
  if (!compilerOptions?.paths) return aliases;

  const baseUrl = (compilerOptions.baseUrl as string) ?? ".";
  const baseDir = resolve(rootDir, baseUrl);
  const paths = compilerOptions.paths as Record<string, string[]>;

  for (const [pattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const target = targets[0];

    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    const targetPath = target.endsWith("*") ? target.slice(0, -1) : target;

    aliases.set(prefix, resolve(baseDir, targetPath));
  }

  // Sort by prefix length descending — longer prefixes match first.
  // e.g., "@components/" matches before "@/" for "@components/Button"
  return new Map(
    [...aliases.entries()].sort((a, b) => b[0].length - a[0].length),
  );
}
