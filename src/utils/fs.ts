/** Shared filesystem utilities used across detection and persistence. */

import { access, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure that `entry` appears in the `.gitignore` at the parent of `dir`.
 * Creates the `.gitignore` if it doesn't exist yet.
 */
export function ensureGitignore(dir: string, entry: string): void {
  try {
    const gitignorePath = resolve(dir, "../.gitignore");
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, "utf-8");
      if (content.split("\n").some((l) => l.trim() === entry)) return;
      writeFileSync(gitignorePath, content.trimEnd() + "\n" + entry + "\n");
    } else {
      writeFileSync(gitignorePath, entry + "\n");
    }
  } catch {
    // Non-critical — skip silently
  }
}
