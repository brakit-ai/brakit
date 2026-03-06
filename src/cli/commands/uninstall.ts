import { defineCommand } from "citty";
import { resolve, join } from "node:path";
import { readFile, writeFile, unlink, rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { detectProject } from "../../detect/project.js";
import { fileExists } from "../../utils/fs.js";
import { METRICS_DIR } from "../../constants/index.js";
import type { DetectedProject } from "../../types/index.js";
import { isExactBrakitTemplate, IMPORT_LINE, CREATED_FILES, ENTRY_CANDIDATES } from "../templates.js";

/** Files where brakit may have prepended an import line (Remix entries + shared candidates). */
const PREPENDED_FILES = [
  "app/entry.server.tsx",
  "app/entry.server.ts",
  ...ENTRY_CANDIDATES,
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

      if (isExactBrakitTemplate(content)) {
        // File is exactly a brakit-generated template — safe to delete
        await unlink(absPath);
        console.log(pc.green(`  ✓ Removed ${relPath}`));
        removed = true;
        break;
      }

      // File has brakit mixed with other content — remove only brakit lines
      const lines = content.split("\n");
      const cleaned = lines.filter(
        (line) => !line.includes('import("brakit")') && !line.includes('import "brakit"'),
      );
      if (cleaned.length < lines.length) {
        await writeFile(absPath, cleaned.join("\n"));
        console.log(pc.green(`  ✓ Removed brakit lines from ${relPath}`));
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

    // 2. Remove MCP config
    const mcpRemoved = await removeMcpConfig(rootDir);
    if (mcpRemoved) {
      console.log(pc.green("  ✓ Removed brakit MCP configuration"));
    }

    // 3. Remove .brakit data directory
    const dataRemoved = await removeBrakitData(rootDir);
    if (dataRemoved) {
      console.log(pc.green("  ✓ Removed .brakit directory"));
    }

    // 4. Clean .brakit from .gitignore
    const gitignoreCleaned = await cleanGitignore(rootDir);
    if (gitignoreCleaned) {
      console.log(pc.green("  ✓ Removed .brakit from .gitignore"));
    }

    // 5. Uninstall package
    const pm = project?.packageManager ?? "npm";
    const uninstalled = await uninstallPackage(rootDir, pm);
    if (uninstalled) {
      console.log(pc.green("  ✓ Removed brakit from devDependencies"));
    }

    console.log();
  },
});

async function removeMcpConfig(rootDir: string): Promise<boolean> {
  const mcpPath = join(rootDir, ".mcp.json");
  if (!(await fileExists(mcpPath))) return false;

  try {
    const raw = await readFile(mcpPath, "utf-8");
    const config = JSON.parse(raw);
    if (!config?.mcpServers?.brakit) return false;

    delete config.mcpServers.brakit;

    // If no MCP servers left, delete the file entirely
    if (Object.keys(config.mcpServers).length === 0) {
      await unlink(mcpPath);
    } else {
      await writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n");
    }
    return true;
  } catch {
    return false;
  }
}

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

async function removeBrakitData(rootDir: string): Promise<boolean> {
  const dataDir = join(rootDir, METRICS_DIR);
  if (!(await fileExists(dataDir))) return false;

  try {
    await rm(dataDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function cleanGitignore(rootDir: string): Promise<boolean> {
  const gitignorePath = join(rootDir, ".gitignore");
  if (!(await fileExists(gitignorePath))) return false;

  try {
    const content = await readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");
    const filtered = lines.filter((line) => line.trim() !== METRICS_DIR);
    if (filtered.length === lines.length) return false;

    await writeFile(gitignorePath, filtered.join("\n"));
    return true;
  } catch {
    return false;
  }
}
