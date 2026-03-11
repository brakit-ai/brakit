import { defineCommand } from "citty";
import { resolve, join, dirname } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { VERSION } from "../../index.js";
import { scanForProjects } from "../../detect/project.js";
import { fileExists } from "../../utils/fs.js";
import { METRICS_DIR } from "../../constants/index.js";
import type { Framework, DetectedProject } from "../../types/index.js";
import { BRAKIT_TEMPLATES, IMPORT_LINE, IMPORT_MARKER, ENTRY_CANDIDATES } from "../templates.js";

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

    console.log();
    console.log(pc.bold("  ◆ brakit install"));
    console.log();

    const projects = await scanForProjects(rootDir);
    const nodeProjects = projects.filter((p) => p.type === "node");
    const pythonProjects = projects.filter((p) => p.type === "python");

    if (nodeProjects.length === 0) {
      if (pythonProjects.length > 0) {
        console.log(pc.dim("  Python project detected. To add brakit:"));
        console.log();
        console.log(pc.bold("  pip install brakit"));
        console.log(pc.dim("  Then add to the top of your entry file:"));
        console.log(pc.bold("  import brakit  # noqa: F401"));
        console.log();
      } else {
        console.error(pc.red("  No project found. Run this from your project directory."));
      }
      process.exit(1);
    }

    // Install Node.js projects
    for (const p of nodeProjects) {
      const node = p.node!;
      const suffix = p.relDir === "." ? "" : ` in ${p.relDir}`;

      const installed = await installPackage(p.dir, node.packageManager);
      if (installed) {
        console.log(pc.green(`  ✓ Added brakit to devDependencies${suffix}`));
      } else {
        console.log(pc.dim(`  ✓ brakit already in dependencies${suffix}`));
      }

      const result = await setupInstrumentation(p.dir, node.framework);
      const prefix = p.relDir === "." ? "" : `${p.relDir}/`;
      if (result.action === "created") {
        console.log(pc.green(`  ✓ Created ${prefix}${result.file}`));
      } else if (result.action === "prepended") {
        console.log(pc.green(`  ✓ Added import to ${prefix}${result.file}`));
      } else if (result.action === "exists") {
        console.log(pc.dim(`  ✓ ${prefix}${result.file} already has brakit import`));
      } else {
        printManualInstructions(node.framework);
      }
    }

    await ensureGitignoreEntry(rootDir, METRICS_DIR);

    // Configure MCP for Claude Code / Cursor
    const mcpResult = await setupMcp(rootDir);
    if (mcpResult === "created" || mcpResult === "updated") {
      console.log(pc.green("  ✓ Configured MCP for Claude Code / Cursor"));
    } else if (mcpResult === "exists") {
      console.log(pc.dim("  ✓ MCP already configured"));
    }

    // Also configure MCP at git root if different (so Claude Code finds it from parent dirs)
    const gitRoot = findGitRoot(rootDir);
    if (gitRoot && gitRoot !== rootDir) {
      const parentMcpResult = await setupMcp(gitRoot);
      if (parentMcpResult === "created" || parentMcpResult === "updated") {
        console.log(pc.green("  ✓ Configured MCP at project root"));
      }
    }

    // Print next steps
    console.log();
    const port = nodeProjects[0]!.node?.defaultPort ?? 3000;
    console.log(pc.dim("  Start your app and visit:"));
    console.log(pc.bold(`  http://localhost:${port}/__brakit`));

    // Hint about detected Python projects
    if (pythonProjects.length > 0) {
      const pyLabel = pythonProjects.map((p) => p.relDir).join(", ");
      console.log();
      console.log(pc.dim(`  Python backend detected (${pyLabel}). To capture telemetry:`));
      console.log(pc.bold("  pip install brakit"));
      console.log(pc.dim("  Then add to the top of your entry file:"));
      console.log(pc.bold("  import brakit  # noqa: F401"));
    }
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
    return false;
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
  const hasSrc = await fileExists(join(rootDir, "src"));
  const relPath = hasSrc ? "src/instrumentation.ts" : "instrumentation.ts";
  const absPath = join(rootDir, relPath);

  if (await fileExists(absPath)) {
    const content = await readFile(absPath, "utf-8");
    if (content.includes(IMPORT_MARKER)) {
      return { action: "exists", file: relPath };
    }
    return { action: "manual", file: relPath };
  }

  const content = BRAKIT_TEMPLATES.nextjs + "\n";

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

  const content = BRAKIT_TEMPLATES.nuxt + "\n";
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

async function setupGeneric(rootDir: string): Promise<InstrumentationSetup> {
  try {
    const pkgRaw = await readFile(join(rootDir, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (pkg.main && typeof pkg.main === "string") {
      const result = await setupPrepend(rootDir, pkg.main);
      if (result.action !== "manual") return result;
    }
  } catch { /* continue to candidates */ }

  const result = await setupPrepend(rootDir, ...ENTRY_CANDIDATES);
  if (result.action !== "manual") return result;

  return { action: "manual", file: null };
}

const MCP_CONFIG = {
  mcpServers: {
    brakit: {
      command: "npx",
      args: ["brakit", "mcp"],
    },
  },
};

async function setupMcp(rootDir: string, config: { mcpServers: Record<string, unknown> } = MCP_CONFIG): Promise<"created" | "updated" | "exists"> {
  const mcpPath = join(rootDir, ".mcp.json");

  if (await fileExists(mcpPath)) {
    const raw = await readFile(mcpPath, "utf-8");
    try {
      const existing = JSON.parse(raw);
      if (existing?.mcpServers?.brakit) return "exists";
      // Merge brakit into existing config
      existing.mcpServers = { ...existing.mcpServers, ...config.mcpServers };
      await writeFile(mcpPath, JSON.stringify(existing, null, 2) + "\n");
      await ensureGitignoreEntry(rootDir, ".mcp.json");
      return "updated";
    } catch {
      // Corrupt JSON — overwrite
    }
  }

  await writeFile(mcpPath, JSON.stringify(config, null, 2) + "\n");
  await ensureGitignoreEntry(rootDir, ".mcp.json");
  return "created";
}

async function ensureGitignoreEntry(rootDir: string, entry: string): Promise<void> {
  const gitignorePath = join(rootDir, ".gitignore");
  try {
    if (await fileExists(gitignorePath)) {
      const content = await readFile(gitignorePath, "utf-8");
      if (content.split("\n").some((l) => l.trim() === entry)) return;
      await writeFile(gitignorePath, content.trimEnd() + "\n" + entry + "\n");
    } else {
      await writeFile(gitignorePath, entry + "\n");
    }
  } catch {
    // Non-critical
  }
}

function findGitRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
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
