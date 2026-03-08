import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Framework, DetectedProject, DetectedPythonProject, PythonPackageManager } from "../types/index.js";
import { fileExists } from "../utils/fs.js";

export type PackageManager = DetectedProject["packageManager"];

interface FrameworkDetector {
  name: Framework;
  dep: string;
  devCmd: string;
  bin: string;
  defaultPort: number;
  devArgs?: string[];
}

// Priority order — first match wins
const FRAMEWORKS: FrameworkDetector[] = [
  { name: "nextjs", dep: "next", devCmd: "next dev", bin: "next", defaultPort: 3000, devArgs: ["dev", "--port"] },
  { name: "remix", dep: "@remix-run/dev", devCmd: "remix dev", bin: "remix", defaultPort: 3000, devArgs: ["dev"] },
  { name: "nuxt", dep: "nuxt", devCmd: "nuxt dev", bin: "nuxt", defaultPort: 3000, devArgs: ["dev", "--port"] },
  { name: "vite", dep: "vite", devCmd: "vite", bin: "vite", defaultPort: 5173, devArgs: ["--port"] },
  { name: "astro", dep: "astro", devCmd: "astro dev", bin: "astro", defaultPort: 4321, devArgs: ["dev", "--port"] },
];

export async function detectProject(
  rootDir: string,
): Promise<DetectedProject> {
  const pkgPath = join(rootDir, "package.json");
  const raw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const framework = detectFrameworkFromDeps(allDeps);
  const matched = FRAMEWORKS.find((f) => f.name === framework);
  const devCommand = matched?.devCmd ?? "";
  const devBin = matched ? join(rootDir, "node_modules", ".bin", matched.bin) : "";
  const defaultPort = matched?.defaultPort ?? 3000;

  const packageManager = await detectPackageManager(rootDir);

  return { framework, devCommand, devBin, defaultPort, packageManager };
}

async function detectPackageManager(
  rootDir: string,
): Promise<PackageManager> {
  if (await fileExists(join(rootDir, "bun.lockb"))) return "bun";
  if (await fileExists(join(rootDir, "bun.lock"))) return "bun";
  if (await fileExists(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(join(rootDir, "yarn.lock"))) return "yarn";
  if (await fileExists(join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}

/** Match framework from a merged dependencies object. */
export function detectFrameworkFromDeps(allDeps: Record<string, unknown>): Framework {
  for (const f of FRAMEWORKS) {
    if (allDeps[f.dep]) return f.name;
  }
  return "unknown";
}

/** Synchronous package manager detection via lock-file presence. */
export function detectPackageManagerSync(rootDir: string): PackageManager {
  if (existsSync(join(rootDir, "bun.lockb")) || existsSync(join(rootDir, "bun.lock"))) return "bun";
  if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
  if (existsSync(join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}

// --- Python project detection ---

const PYTHON_ENTRY_CANDIDATES = [
  "app.py",
  "main.py",
  "wsgi.py",
  "asgi.py",
  "server.py",
  "run.py",
  "manage.py",
  "app/__init__.py",
];

const PYTHON_FRAMEWORK_MAP: Record<string, DetectedPythonProject["framework"]> = {
  flask: "flask",
  fastapi: "fastapi",
  django: "django",
};

const PYTHON_DEFAULT_PORTS: Record<string, number> = {
  flask: 5000,
  fastapi: 8000,
  django: 8000,
  unknown: 8000,
};

export async function detectPythonProject(
  rootDir: string,
): Promise<DetectedPythonProject | null> {
  const hasPyproject = await fileExists(join(rootDir, "pyproject.toml"));
  const hasRequirements = await fileExists(join(rootDir, "requirements.txt"));
  const hasSetupPy = await fileExists(join(rootDir, "setup.py"));

  if (!hasPyproject && !hasRequirements && !hasSetupPy) return null;

  const framework = await detectPythonFramework(rootDir, hasPyproject, hasRequirements);
  const packageManager = await detectPythonPackageManager(rootDir);
  const entryFile = await detectPythonEntry(rootDir);

  return {
    framework,
    packageManager,
    entryFile,
    defaultPort: PYTHON_DEFAULT_PORTS[framework] ?? 8000,
  };
}

async function detectPythonFramework(
  rootDir: string,
  hasPyproject: boolean,
  hasRequirements: boolean,
): Promise<DetectedPythonProject["framework"]> {
  if (hasPyproject) {
    try {
      const content = await readFile(join(rootDir, "pyproject.toml"), "utf-8");
      for (const [dep, fw] of Object.entries(PYTHON_FRAMEWORK_MAP)) {
        if (content.includes(`"${dep}"`) || content.includes(`'${dep}'`) || content.includes(`${dep} `)) {
          return fw;
        }
      }
    } catch { /* fall through */ }
  }

  if (hasRequirements) {
    try {
      const content = await readFile(join(rootDir, "requirements.txt"), "utf-8");
      const lines = content.toLowerCase().split("\n");
      for (const [dep, fw] of Object.entries(PYTHON_FRAMEWORK_MAP)) {
        if (lines.some((l) => l.startsWith(dep) && (l.length === dep.length || /[=<>~![]/u.test(l[dep.length]!)))) {
          return fw;
        }
      }
    } catch { /* fall through */ }
  }

  return "unknown";
}

async function detectPythonPackageManager(rootDir: string): Promise<PythonPackageManager> {
  if (await fileExists(join(rootDir, "uv.lock"))) return "uv";
  if (await fileExists(join(rootDir, "poetry.lock"))) return "poetry";
  if (await fileExists(join(rootDir, "Pipfile.lock"))) return "pipenv";
  if (await fileExists(join(rootDir, "Pipfile"))) return "pipenv";
  if (await fileExists(join(rootDir, "requirements.txt"))) return "pip";

  try {
    const content = await readFile(join(rootDir, "pyproject.toml"), "utf-8");
    if (content.includes("[tool.poetry]")) return "poetry";
    if (content.includes("[tool.uv]")) return "uv";
  } catch { /* fall through */ }

  return "unknown";
}

async function detectPythonEntry(rootDir: string): Promise<string | null> {
  for (const candidate of PYTHON_ENTRY_CANDIDATES) {
    if (await fileExists(join(rootDir, candidate))) {
      return candidate;
    }
  }
  return null;
}

// --- Full-stack project scanning ---

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".brakit", "dist", "build", "__pycache__",
  ".venv", "venv", ".next", ".nuxt", ".output", ".cache", "coverage",
]);

export interface ScannedProject {
  dir: string;
  relDir: string;
  type: "node" | "python";
  node?: DetectedProject;
  python?: DetectedPythonProject;
}

export async function scanForProjects(rootDir: string): Promise<ScannedProject[]> {
  const projects: ScannedProject[] = [];

  // Check rootDir itself
  await detectInDir(rootDir, rootDir, projects);

  // Scan immediate children
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      const childDir = join(rootDir, entry.name);
      await detectInDir(childDir, rootDir, projects);
    }
  } catch {
    // Can't read children — that's fine, we still have rootDir results
  }

  return projects;
}

async function detectInDir(dir: string, rootDir: string, projects: ScannedProject[]): Promise<void> {
  const rel = dir === rootDir ? "." : `./${relative(rootDir, dir)}`;

  // Check for Node.js project
  if (await fileExists(join(dir, "package.json"))) {
    try {
      const node = await detectProject(dir);
      projects.push({ dir, relDir: rel, type: "node", node });
    } catch {
      // Invalid package.json — skip
    }
  }

  // Check for Python project
  const python = await detectPythonProject(dir);
  if (python) {
    projects.push({ dir, relDir: rel, type: "python", python });
  }
}
