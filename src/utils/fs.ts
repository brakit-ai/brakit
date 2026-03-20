/** Shared filesystem utilities used across detection and persistence. */

import { access, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { PROJECT_HASH_LENGTH } from "../constants/config.js";
import { brakitDebug } from "./log.js";
import { getErrorMessage } from "./type-guards.js";

/**
 * Return a per-project data directory under the user's home directory.
 * This keeps runtime data (metrics, findings) out of the project root
 * so dev-server file watchers are never triggered by brakit writes.
 *
 * Layout: ~/.brakit/projects/<hash>/
 * where <hash> is an 8-char hex digest of the absolute project path.
 */
export function getProjectDataDir(projectRoot: string): string {
  const absolute = resolve(projectRoot);
  const hash = createHash("sha256").update(absolute).digest("hex").slice(0, PROJECT_HASH_LENGTH);
  return join(homedir(), ".brakit", "projects", hash);
}

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
  } catch (err) {
    brakitDebug(`ensureGitignore failed: ${getErrorMessage(err)}`);
  }
}

/** Async variant of ensureGitignore — for use in non-blocking paths. */
export async function ensureGitignoreAsync(dir: string, entry: string): Promise<void> {
  try {
    const gitignorePath = resolve(dir, "../.gitignore");
    if (await fileExists(gitignorePath)) {
      const content = await readFile(gitignorePath, "utf-8");
      if (content.split("\n").some((l) => l.trim() === entry)) return;
      await writeFile(gitignorePath, content.trimEnd() + "\n" + entry + "\n");
    } else {
      await writeFile(gitignorePath, entry + "\n");
    }
  } catch (err) {
    brakitDebug(`ensureGitignoreAsync failed: ${getErrorMessage(err)}`);
  }
}
