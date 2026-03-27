import { defineCommand } from "citty";
import { resolve, join, relative } from "node:path";
import { readFile, writeFile, unlink, rm, readdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { scanForProjects } from "../../detect/project.js";
import { fileExists, getProjectDataDir } from "../../utils/fs.js";
import {
  METRICS_DIR,
  SUPPORTED_SOURCE_EXTENSIONS,
  BUILD_CACHE_DIRS,
  FALLBACK_SCAN_DIRS,
} from "../../constants/index.js";
import type { DetectedProject } from "../../types/index.js";
import {
  isExactBrakitTemplate,
  IMPORT_LINE,
  CREATED_FILES,
  ENTRY_CANDIDATES,
  containsBrakitImport,
  removeBrakitImportLines,
} from "../templates.js";
import { brakitDebug } from "../../utils/log.js";
import { getErrorMessage } from "../../utils/type-guards.js";
import { trackEvent } from "../../telemetry/index.js";
import { TELEMETRY_EVENT_CLI_UNINSTALL } from "../../constants/config.js";

/**
 * Entry point files where brakit may have prepended an import line.
 * Includes Remix entry files plus the standard ENTRY_CANDIDATES.
 */
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

    let projects: { dir: string; pm: DetectedProject["packageManager"] }[] = [];
    try {
      const scanned = await scanForProjects(rootDir);
      projects = scanned
        .filter((p) => p.type === "node" && p.node)
        .map((p) => ({ dir: p.dir, pm: p.node!.packageManager }));
    } catch (err) { brakitDebug(`uninstall: project scan failed: ${getErrorMessage(err)}`); }

    // Fall back to rootDir if no projects detected
    if (projects.length === 0) {
      projects = [{ dir: rootDir, pm: "npm" }];
    }

    console.log();
    console.log(pc.bold("  ◆ brakit uninstall"));
    console.log();

    let anyInstrumentationRemoved = false;
    let anyPackageRemoved = false;

    for (const project of projects) {
      const suffix = projects.length > 1
        ? ` in ${relative(rootDir, project.dir) || "."}`
        : "";

      const removed = await removeInstrumentation(project.dir);
      if (removed) {
        anyInstrumentationRemoved = true;
        console.log(pc.green(`  ✓ ${removed}${suffix}`));
      } else {
        console.log(pc.dim(`  No brakit instrumentation files found${suffix}.`));
      }

      const uninstalled = await uninstallPackage(project.dir, project.pm);
      if (uninstalled === true) {
        anyPackageRemoved = true;
        console.log(pc.green(`  ✓ Removed brakit from devDependencies${suffix}`));
      } else if (uninstalled === "failed") {
        // Warning already printed by uninstallPackage
      }
    }

    // 3. Remove MCP config (at rootDir level)
    const mcpRemoved = await removeMcpConfig(rootDir);
    if (mcpRemoved) {
      console.log(pc.green("  ✓ Removed brakit MCP configuration"));
    }

    // 4. Remove .brakit data directory
    const dataRemoved = await removeBrakitData(rootDir);
    if (dataRemoved) {
      console.log(pc.green("  ✓ Removed .brakit data"));
    }

    // 5. Clean .brakit from .gitignore
    const gitignoreCleaned = await cleanGitignore(rootDir);
    if (gitignoreCleaned) {
      console.log(pc.green("  ✓ Removed .brakit from .gitignore"));
    }

    // 6. Clear framework build caches that may hold stale brakit references
    const cacheCleared = await clearBuildCaches(rootDir);
    if (cacheCleared) {
      console.log(pc.green("  ✓ Cleared build cache"));
    }

    trackEvent(TELEMETRY_EVENT_CLI_UNINSTALL, {
      instrumentation_removed: anyInstrumentationRemoved,
      package_removed: anyPackageRemoved,
      mcp_removed: mcpRemoved,
      data_removed: dataRemoved,
    });

    console.log();
  },
});

/**
 * Attempt to remove brakit instrumentation from a project directory.
 * Returns a human-readable description of what was removed, or null.
 */
async function removeInstrumentation(projectDir: string): Promise<string | null> {
  for (const relPath of CREATED_FILES) {
    const result = await tryRemoveBrakitFromFile(projectDir, relPath);
    if (result) return result;
  }

  const candidates = [...PREPENDED_FILES];
  try {
    const pkgRaw = await readFile(join(projectDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (pkg.main) candidates.unshift(pkg.main);
  } catch (err) { brakitDebug(`uninstall: no package.json main: ${getErrorMessage(err)}`); }

  for (const relPath of candidates) {
    const result = await tryRemoveImportLine(projectDir, relPath);
    if (result) return result;
  }

  const result = await fallbackSearchAndRemove(projectDir);
  if (result) return result;

  return null;
}

/**
 * Check if a file is a brakit-created file and remove/clean it.
 */
async function tryRemoveBrakitFromFile(projectDir: string, relPath: string): Promise<string | null> {
  const absPath = join(projectDir, relPath);
  if (!(await fileExists(absPath))) return null;
  const content = await readFile(absPath, "utf-8");
  if (!content.includes("brakit")) return null;

  if (isExactBrakitTemplate(content)) {
    await unlink(absPath);
    return `Removed ${relPath}`;
  }

  const lines = content.split("\n");
  const cleaned = removeBrakitImportLines(lines);
  if (cleaned.length < lines.length) {
    await writeFile(absPath, cleaned.join("\n"));
    return `Removed brakit lines from ${relPath}`;
  }

  return null;
}

/**
 * Check if a file has the exact `import "brakit";` line and remove it.
 */
async function tryRemoveImportLine(projectDir: string, relPath: string): Promise<string | null> {
  const absPath = join(projectDir, relPath);
  if (!(await fileExists(absPath))) return null;
  const content = await readFile(absPath, "utf-8");
  if (!content.includes(IMPORT_LINE)) return null;

  const updated = content
    .split("\n")
    .filter((line) => line.trim() !== IMPORT_LINE.trim())
    .join("\n");
  await writeFile(absPath, updated);
  return `Removed brakit import from ${relPath}`;
}

/**
 * Fallback: scan common source directories for any file importing brakit.
 */
async function fallbackSearchAndRemove(projectDir: string): Promise<string | null> {
  const dirsToScan = FALLBACK_SCAN_DIRS;

  for (const dir of dirsToScan) {
    const absDir = join(projectDir, dir);
    if (!(await fileExists(absDir))) continue;

    let entries: string[];
    try {
      entries = await readdir(absDir);
    } catch (err) { brakitDebug(`uninstall: could not read ${absDir}: ${getErrorMessage(err)}`); continue; }

    for (const entry of entries) {
      const ext = entry.slice(entry.lastIndexOf("."));
      if (!SUPPORTED_SOURCE_EXTENSIONS.has(ext)) continue;

      const relPath = dir === "." ? entry : `${dir}/${entry}`;
      const absPath = join(projectDir, relPath);

      try {
        const content = await readFile(absPath, "utf-8");
        if (!containsBrakitImport(content)) continue;

        if (isExactBrakitTemplate(content)) {
          await unlink(absPath);
          return `Removed ${relPath}`;
        }

        const lines = content.split("\n");
        const cleaned = removeBrakitImportLines(lines);
        if (cleaned.length < lines.length) {
          await writeFile(absPath, cleaned.join("\n"));
          return `Removed brakit import from ${relPath}`;
        }
      } catch (err) { brakitDebug(`uninstall: fallback scan failed for ${relPath}: ${getErrorMessage(err)}`); continue; }
    }
  }

  return null;
}

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
  } catch (err) {
    brakitDebug(`uninstall: MCP config cleanup failed: ${getErrorMessage(err)}`);
    return false;
  }
}

async function uninstallPackage(rootDir: string, pm: DetectedProject["packageManager"]): Promise<boolean | "failed"> {
  try {
    const pkgRaw = await readFile(join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (!pkg.devDependencies?.brakit && !pkg.dependencies?.brakit) return false;
  } catch (err) {
    brakitDebug(`uninstall: could not read package.json: ${getErrorMessage(err)}`);
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
    return true;
  } catch {
    console.warn(pc.yellow(`  ⚠ Failed to run "${cmd}". Remove brakit manually.`));
    return "failed";
  }
}

async function removeBrakitData(rootDir: string): Promise<boolean> {
  let removed = false;

  // Remove project-root .brakit/ directory (port file, legacy data)
  const projectDir = join(rootDir, METRICS_DIR);
  if (await fileExists(projectDir)) {
    try {
      await rm(projectDir, { recursive: true, force: true });
      removed = true;
    } catch (err) { brakitDebug(`uninstall: could not remove ${projectDir}: ${getErrorMessage(err)}`); }
  }

  // Remove home-directory data (metrics, findings)
  const homeDataDir = getProjectDataDir(rootDir);
  if (await fileExists(homeDataDir)) {
    try {
      await rm(homeDataDir, { recursive: true, force: true });
      removed = true;
    } catch (err) { brakitDebug(`uninstall: could not remove ${homeDataDir}: ${getErrorMessage(err)}`); }
  }

  return removed;
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
  } catch (err) {
    brakitDebug(`uninstall: gitignore cleanup failed: ${getErrorMessage(err)}`);
    return false;
  }
}

async function clearBuildCaches(rootDir: string): Promise<boolean> {
  let cleared = false;

  for (const dir of BUILD_CACHE_DIRS) {
    const absDir = join(rootDir, dir);
    if (!(await fileExists(absDir))) continue;
    try {
      await rm(absDir, { recursive: true, force: true });
      cleared = true;
    } catch (err) { brakitDebug(`uninstall: could not clear cache ${absDir}: ${getErrorMessage(err)}`); }
  }

  return cleared;
}
