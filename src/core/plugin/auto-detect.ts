import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectContext, StackInfo } from "../types/context.js";
import type { BrakitPlugin } from "./types.js";

export async function detectProjectContext(
  rootDir: string,
): Promise<ProjectContext> {
  const pkgPath = join(rootDir, "package.json");
  let deps: Record<string, string> = {};
  let devDeps: Record<string, string> = {};

  try {
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    deps = pkg.dependencies ?? {};
    devDeps = pkg.devDependencies ?? {};
  } catch {
    return emptyContext(rootDir);
  }

  const allDeps = { ...deps, ...devDeps };

  return {
    rootDir,
    framework: await detectFramework(allDeps, rootDir),
    orm: detectORM(allDeps),
    auth: detectAuth(allDeps),
    baas: detectBaaS(allDeps),
    packageManager: await detectPackageManager(rootDir),
    typescript: await fileExists(join(rootDir, "tsconfig.json")),
    dependencies: deps,
    devDependencies: devDeps,
  };
}

// Maps detected dependencies to built-in plugins.
// Deduplicates when multiple deps map to the same plugin (e.g., prisma + @prisma/client).
export async function detectPlugins(
  context: ProjectContext,
): Promise<BrakitPlugin[]> {
  const allDeps = { ...context.dependencies, ...context.devDependencies };
  const loaded = new Map<string, BrakitPlugin>();

  for (const dep of Object.keys(allDeps)) {
    const mapping = DEPENDENCY_MAP[dep];
    if (mapping && !loaded.has(mapping.pluginName)) {
      const plugin = await mapping.load();
      loaded.set(mapping.pluginName, plugin);
    }
  }

  // Always load the compounds plugin for cross-plugin rules.
  const { compounds } = await import("../../plugins/compounds/index.js");
  loaded.set("compounds", compounds());

  return Array.from(loaded.values());
}

interface PluginMapping {
  pluginName: string;
  load: () => Promise<BrakitPlugin>;
}

const DEPENDENCY_MAP: Record<string, PluginMapping> = {
  next: {
    pluginName: "nextjs",
    load: () =>
      import("../../plugins/nextjs/index.js").then((m) => m.nextjs()),
  },
  "@prisma/client": {
    pluginName: "prisma",
    load: () =>
      import("../../plugins/prisma/index.js").then((m) => m.prisma()),
  },
  prisma: {
    pluginName: "prisma",
    load: () =>
      import("../../plugins/prisma/index.js").then((m) => m.prisma()),
  },
  "@supabase/supabase-js": {
    pluginName: "supabase",
    load: () =>
      import("../../plugins/supabase/index.js").then((m) => m.supabase()),
  },
  "next-auth": {
    pluginName: "auth",
    load: () => import("../../plugins/auth/index.js").then((m) => m.auth()),
  },
  "@clerk/nextjs": {
    pluginName: "auth",
    load: () => import("../../plugins/auth/index.js").then((m) => m.auth()),
  },
  "@auth/core": {
    pluginName: "auth",
    load: () => import("../../plugins/auth/index.js").then((m) => m.auth()),
  },
};

async function detectFramework(
  allDeps: Record<string, string>,
  rootDir: string,
): Promise<StackInfo | null> {
  const version = allDeps["next"];
  if (!version) return null;

  const hasAppDir =
    (await fileExists(join(rootDir, "app"))) ||
    (await fileExists(join(rootDir, "src/app")));
  const hasPagesDir =
    (await fileExists(join(rootDir, "pages"))) ||
    (await fileExists(join(rootDir, "src/pages")));

  return {
    name: "nextjs",
    version,
    details: {
      router: hasAppDir ? "app" : hasPagesDir ? "pages" : "unknown",
      hasAppDir,
      hasPagesDir,
    },
  };
}

function detectORM(allDeps: Record<string, string>): StackInfo | null {
  const version = allDeps["@prisma/client"] ?? allDeps["prisma"];
  if (!version) return null;
  return { name: "prisma", version, details: {} };
}

function detectAuth(allDeps: Record<string, string>): StackInfo | null {
  if (allDeps["next-auth"]) {
    return { name: "next-auth", version: allDeps["next-auth"], details: {} };
  }
  if (allDeps["@clerk/nextjs"]) {
    return { name: "clerk", version: allDeps["@clerk/nextjs"], details: {} };
  }
  if (allDeps["@auth/core"]) {
    return { name: "auth.js", version: allDeps["@auth/core"], details: {} };
  }
  return null;
}

function detectBaaS(allDeps: Record<string, string>): StackInfo | null {
  const version = allDeps["@supabase/supabase-js"];
  if (!version) return null;
  return { name: "supabase", version, details: {} };
}

async function detectPackageManager(
  rootDir: string,
): Promise<ProjectContext["packageManager"]> {
  if (await fileExists(join(rootDir, "bun.lockb"))) return "bun";
  if (await fileExists(join(rootDir, "bun.lock"))) return "bun";
  if (await fileExists(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(join(rootDir, "yarn.lock"))) return "yarn";
  if (await fileExists(join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function emptyContext(rootDir: string): ProjectContext {
  return {
    rootDir,
    framework: null,
    orm: null,
    auth: null,
    baas: null,
    packageManager: "unknown",
    typescript: false,
    dependencies: {},
    devDependencies: {},
  };
}
