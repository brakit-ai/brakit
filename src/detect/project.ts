import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { DetectedProject } from "../types.js";

export async function detectProject(
  rootDir: string,
): Promise<DetectedProject> {
  const pkgPath = join(rootDir, "package.json");
  const raw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  let framework: DetectedProject["framework"] = "unknown";
  let devCommand = "";
  let devBin = "";
  let defaultPort = 3000;

  if (allDeps["next"]) {
    framework = "nextjs";
    devCommand = "next dev";
    devBin = join(rootDir, "node_modules", ".bin", "next");
    defaultPort = 3000;
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
