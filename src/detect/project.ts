import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Framework, DetectedProject } from "../types/index.js";
import { fileExists } from "../utils/fs.js";

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

  let framework: Framework = "unknown";
  let devCommand = "";
  let devBin = "";
  let defaultPort = 3000;

  for (const f of FRAMEWORKS) {
    if (allDeps[f.dep]) {
      framework = f.name;
      devCommand = f.devCmd;
      devBin = join(rootDir, "node_modules", ".bin", f.bin);
      defaultPort = f.defaultPort;
      break;
    }
  }

  const packageManager = await detectPackageManager(rootDir);

  return { framework, devCommand, devBin, defaultPort, packageManager };
}

async function detectPackageManager(
  rootDir: string,
): Promise<DetectedProject["packageManager"]> {
  if (await fileExists(join(rootDir, "bun.lockb"))) return "bun";
  if (await fileExists(join(rootDir, "bun.lock"))) return "bun";
  if (await fileExists(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (await fileExists(join(rootDir, "yarn.lock"))) return "yarn";
  if (await fileExists(join(rootDir, "package-lock.json"))) return "npm";
  return "unknown";
}
