import { defineCommand } from "citty";
import { resolve, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { detectProject } from "../../detect/project.js";
import { fileExists } from "../../utils/fs.js";
import type { Framework, DetectedProject } from "../../types/index.js";

const IMPORT_LINE = `import "brakit";`;
const IMPORT_MARKER = "brakit";

export default defineCommand({
  meta: {
    name: "brakit install",
    version: VERSION,
    description: "Set up brakit in your project",
  },
  args: {
    dir: {
      type: "positional",
      description: "Project directory",
      required: false,
      default: ".",
    },
  },
  async run({ args }) {
    const rootDir = resolve(args.dir as string);
    const pkgPath = join(rootDir, "package.json");

    if (!(await fileExists(pkgPath))) {
      console.error(pc.red("  No package.json found. Run this from your project root."));
      process.exit(1);
    }

    let project: DetectedProject;
    try {
      project = await detectProject(rootDir);
    } catch {
      console.error(pc.red("  Failed to read package.json."));
      process.exit(1);
    }

    console.log();
    console.log(pc.bold("  ◆ brakit install"));
    console.log();

    // 1. Install brakit as devDependency
    const installed = await installPackage(rootDir, project.packageManager);
    if (installed) {
      console.log(pc.green("  ✓ Added brakit to devDependencies"));
    } else {
      console.log(pc.dim("  ✓ brakit already in dependencies"));
    }

    // 2. Create instrumentation file
    const result = await setupInstrumentation(rootDir, project.framework);

    if (result.action === "created") {
      console.log(pc.green(`  ✓ Created ${result.file}`));
      if (result.content) {
        console.log();
        for (const line of result.content.split("\n")) {
          console.log(pc.dim(`    ${line}`));
        }
      }
    } else if (result.action === "prepended") {
      console.log(pc.green(`  ✓ Added import to ${result.file}`));
    } else if (result.action === "exists") {
      console.log(pc.dim(`  ✓ ${result.file} already has brakit import`));
    } else {
      printManualInstructions(project.framework);
    }

    // 3. Print next steps
    console.log();
    console.log(pc.dim("  Start your app and visit:"));
    console.log(pc.bold("  http://localhost:<port>/__brakit"));
    console.log();
  },
});

async function installPackage(rootDir: string, pm: DetectedProject["packageManager"]): Promise<boolean> {
  const pkgRaw = await readFile(join(rootDir, "package.json"), "utf-8");
  const pkg = JSON.parse(pkgRaw);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (allDeps["brakit"]) return false;

  const cmds: Record<string, string> = {
    npm: "npm install --save-dev brakit",
    pnpm: "pnpm add -D brakit",
    yarn: "yarn add -D brakit",
    bun: "bun add -D brakit",
  };
  const cmd = cmds[pm] ?? cmds.npm;

  try {
    execSync(cmd, { cwd: rootDir, stdio: "pipe" });
  } catch {
    console.warn(pc.yellow(`  ⚠ Failed to run "${cmd}". Install brakit manually.`));
  }
  return true;
}

interface InstrumentationSetup {
  action: "created" | "prepended" | "exists" | "manual";
  file: string | null;
  content?: string;
}

async function setupInstrumentation(rootDir: string, framework: Framework): Promise<InstrumentationSetup> {
  switch (framework) {
    case "nextjs":
      return setupNextjs(rootDir);
    case "nuxt":
      return setupNuxt(rootDir);
    case "remix":
      return setupPrepend(rootDir, "app/entry.server.tsx", "app/entry.server.ts");
    default:
      return setupGeneric(rootDir);
  }
}

async function setupNextjs(rootDir: string): Promise<InstrumentationSetup> {
  // Next.js uses instrumentation.ts — check src/ first
  const hasSrc = await fileExists(join(rootDir, "src"));
  const relPath = hasSrc ? "src/instrumentation.ts" : "instrumentation.ts";
  const absPath = join(rootDir, relPath);

  if (await fileExists(absPath)) {
    const content = await readFile(absPath, "utf-8");
    if (content.includes(IMPORT_MARKER)) {
      return { action: "exists", file: relPath };
    }
    // File exists without brakit — don't auto-merge
    return { action: "manual", file: relPath };
  }

  const content = [
    `export async function register() {`,
    `  if (process.env.NODE_ENV !== "production") {`,
    `    try { await import("brakit"); } catch {}`,
    `  }`,
    `}`,
    ``,
  ].join("\n");

  await writeFile(absPath, content);
  return { action: "created", file: relPath, content };
}

async function setupNuxt(rootDir: string): Promise<InstrumentationSetup> {
  const relPath = "server/plugins/brakit.ts";
  const absPath = join(rootDir, relPath);

  if (await fileExists(absPath)) {
    const content = await readFile(absPath, "utf-8");
    if (content.includes(IMPORT_MARKER)) {
      return { action: "exists", file: relPath };
    }
    return { action: "manual", file: relPath };
  }

  const content = `${IMPORT_LINE}\n`;
  const dir = join(rootDir, "server/plugins");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  await writeFile(absPath, content);
  return { action: "created", file: relPath, content };
}

async function setupPrepend(rootDir: string, ...candidates: string[]): Promise<InstrumentationSetup> {
  for (const relPath of candidates) {
    const absPath = join(rootDir, relPath);
    if (!(await fileExists(absPath))) continue;

    const content = await readFile(absPath, "utf-8");
    if (content.includes(IMPORT_MARKER)) {
      return { action: "exists", file: relPath };
    }

    await writeFile(absPath, `${IMPORT_LINE}\n${content}`);
    return { action: "prepended", file: relPath };
  }
  return { action: "manual", file: null };
}

const ENTRY_CANDIDATES = [
  "src/index.ts", "src/server.ts", "src/app.ts",
  "src/index.js", "src/server.js", "src/app.js",
  "server.ts", "app.ts", "index.ts",
  "server.js", "app.js", "index.js",
];

async function setupGeneric(rootDir: string): Promise<InstrumentationSetup> {
  // Check package.json main field first
  try {
    const pkgRaw = await readFile(join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (pkg.main && typeof pkg.main === "string") {
      const result = await setupPrepend(rootDir, pkg.main);
      if (result.action !== "manual") return result;
    }
  } catch { /* continue to candidates */ }

  // Try common entry files
  const result = await setupPrepend(rootDir, ...ENTRY_CANDIDATES);
  if (result.action !== "manual") return result;

  return { action: "manual", file: null };
}

function printManualInstructions(framework: Framework): void {
  console.log(pc.yellow("  ⚠ Could not auto-detect entry file."));
  console.log();
  console.log(pc.dim("  Add this to the top of your entry file:"));
  console.log();

  if (framework === "nextjs") {
    console.log(pc.bold("  // instrumentation.ts"));
    console.log(`  export async function register() {`);
    console.log(`    if (process.env.NODE_ENV !== "production") {`);
    console.log(`      try { await import("brakit"); } catch {}`);
    console.log(`    }`);
    console.log(`  }`);
  } else {
    console.log(pc.bold(`  ${IMPORT_LINE}`));
  }
}
