import { defineCommand } from "citty";
import { resolve, join } from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { execSync } from "node:child_process";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { detectProject } from "../../detect/project.js";
import { fileExists } from "../../utils/fs.js";
import type { DetectedProject } from "../../types/index.js";

const IMPORT_LINE = `import "brakit";`;

/** Files brakit install may have created — checked in order. */
const CREATED_FILES = [
  "src/instrumentation.ts",
  "instrumentation.ts",
  "server/plugins/brakit.ts",
];

/** Files where brakit may have prepended an import line. */
const PREPENDED_FILES = [
  "app/entry.server.tsx",
  "app/entry.server.ts",
  "src/index.ts", "src/server.ts", "src/app.ts",
  "src/index.js", "src/server.js", "src/app.js",
  "server.ts", "app.ts", "index.ts",
  "server.js", "app.js", "index.js",
];

export default defineCommand({
  meta: {
    name: "brakit uninstall",
    version: VERSION,
    description: "Remove brakit from your project",
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

    let project: DetectedProject | null = null;
    try {
      project = await detectProject(rootDir);
    } catch { /* proceed without detection */ }

    console.log();
    console.log(pc.bold("  ◆ brakit uninstall"));
    console.log();

    // 1. Remove instrumentation file or import line
    let removed = false;

    // Check files brakit may have created entirely
    for (const relPath of CREATED_FILES) {
      const absPath = join(rootDir, relPath);
      if (!(await fileExists(absPath))) continue;
      const content = await readFile(absPath, "utf-8");
      if (!content.includes("brakit")) continue;

      // Only delete if brakit is the sole purpose of the file
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      const allBrakit = lines.every((l) => l.includes("brakit") || l.includes("register") || l.includes("import") || l.includes("export") || l.includes("try") || l.includes("catch") || l.includes("process.env") || l.includes("{") || l.includes("}"));
      if (allBrakit) {
        await unlink(absPath);
        console.log(pc.green(`  ✓ Removed ${relPath}`));
        removed = true;
        break;
      }
    }

    // Check files where brakit may have prepended a line
    if (!removed) {
      // Also check package.json main
      const candidates = [...PREPENDED_FILES];
      try {
        const pkgRaw = await readFile(join(rootDir, "package.json"), "utf-8");
        const pkg = JSON.parse(pkgRaw);
        if (pkg.main) candidates.unshift(pkg.main);
      } catch { /* no package.json main */ }

      for (const relPath of candidates) {
        const absPath = join(rootDir, relPath);
        if (!(await fileExists(absPath))) continue;
        const content = await readFile(absPath, "utf-8");
        if (!content.includes(IMPORT_LINE)) continue;

        const updated = content
          .split("\n")
          .filter((line) => line.trim() !== IMPORT_LINE.trim())
          .join("\n");
        await writeFile(absPath, updated);
        console.log(pc.green(`  ✓ Removed brakit import from ${relPath}`));
        removed = true;
        break;
      }
    }

    if (!removed) {
      console.log(pc.dim("  No brakit instrumentation files found."));
    }

    // 2. Uninstall package
    const pm = project?.packageManager ?? "npm";
    const uninstalled = await uninstallPackage(rootDir, pm);
    if (uninstalled) {
      console.log(pc.green("  ✓ Removed brakit from devDependencies"));
    }

    console.log();
  },
});

async function uninstallPackage(rootDir: string, pm: DetectedProject["packageManager"]): Promise<boolean> {
  try {
    const pkgRaw = await readFile(join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (!pkg.devDependencies?.brakit && !pkg.dependencies?.brakit) return false;
  } catch {
    return false;
  }

  const cmds: Record<string, string> = {
    npm: "npm uninstall brakit",
    pnpm: "pnpm remove brakit",
    yarn: "yarn remove brakit",
    bun: "bun remove brakit",
  };
  const cmd = cmds[pm] ?? cmds.npm;

  try {
    execSync(cmd, { cwd: rootDir, stdio: "pipe" });
  } catch {
    console.warn(pc.yellow(`  ⚠ Failed to run "${cmd}". Remove brakit manually.`));
  }
  return true;
}
