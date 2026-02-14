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

export async function detectPlugins(
  context: ProjectContext,
): Promise<BrakitPlugin[]> {
  const allDeps = { ...context.dependencies, ...context.devDependencies };
  const loaded = new Map<string, BrakitPlugin>();

  for (const dep of Object.keys(allDeps)) {
    const mapping = DEPENDENCY_MAP[dep];
    if (mapping && !loaded.has(mapping.pluginName)) {
      const plugin = await mapping.load(context);
      loaded.set(mapping.pluginName, plugin);
    }
  }

  const { compounds } = await import("../../plugins/compounds/index.js");
  loaded.set("compounds", compounds(context));

  return Array.from(loaded.values());
}

interface PluginMapping {
  pluginName: string;
  load: (ctx: ProjectContext) => Promise<BrakitPlugin>;
}

const DEPENDENCY_MAP: Record<string, PluginMapping> = {
  next: {
    pluginName: "nextjs",
    load: (ctx) =>
      import("../../plugins/nextjs/index.js").then((m) => m.nextjs(ctx)),
  },
  "@prisma/client": {
    pluginName: "prisma",
    load: (ctx) =>
      import("../../plugins/prisma/index.js").then((m) => m.prisma(ctx)),
  },
  prisma: {
    pluginName: "prisma",
    load: (ctx) =>
      import("../../plugins/prisma/index.js").then((m) => m.prisma(ctx)),
  },
  "@supabase/supabase-js": {
    pluginName: "supabase",
    load: (ctx) =>
      import("../../plugins/supabase/index.js").then((m) => m.supabase(ctx)),
  },
  "next-auth": {
    pluginName: "auth",
    load: (ctx) =>
      import("../../plugins/auth/index.js").then((m) => m.auth(ctx)),
  },
  "@clerk/nextjs": {
    pluginName: "auth",
    load: (ctx) =>
      import("../../plugins/auth/index.js").then((m) => m.auth(ctx)),
  },
  "@auth/core": {
    pluginName: "auth",
    load: (ctx) =>
      import("../../plugins/auth/index.js").then((m) => m.auth(ctx)),
  },
  "@supabase/auth-helpers-nextjs": {
    pluginName: "auth",
    load: (ctx) =>
      import("../../plugins/auth/index.js").then((m) => m.auth(ctx)),
  },
  "@supabase/ssr": {
    pluginName: "auth",
    load: (ctx) =>
      import("../../plugins/auth/index.js").then((m) => m.auth(ctx)),
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
  if (allDeps["@supabase/auth-helpers-nextjs"]) {
    return { name: "supabase-auth", version: allDeps["@supabase/auth-helpers-nextjs"], details: {} };
  }
  if (allDeps["@supabase/ssr"]) {
    return { name: "supabase-auth", version: allDeps["@supabase/ssr"], details: {} };
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
