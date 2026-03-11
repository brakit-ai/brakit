/**
 * Atomic file writer with write coalescing.
 *
 * Writes data to a temporary file then renames it to the target path,
 * ensuring the target is never left in a partially-written state.
 * Concurrent writes are coalesced — if a write is in progress, the latest
 * data is queued and written once the current operation completes.
 */
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { writeFile, mkdir, rename } from "node:fs/promises";
import { ensureGitignore, ensureGitignoreAsync, fileExists } from "./fs.js";
import { brakitWarn } from "./log.js";
import { getErrorMessage } from "./type-guards.js";

export interface AtomicWriterOptions {
  dir: string;
  filePath: string;
  gitignoreEntry?: string;
  label: string;
}

export class AtomicWriter {
  private readonly tmpPath: string;
  private writing = false;
  private pendingContent: string | null = null;

  constructor(private readonly opts: AtomicWriterOptions) {
    this.tmpPath = opts.filePath + ".tmp";
  }

  writeSync(content: string): void {
    try {
      this.ensureDir();
      writeFileSync(this.tmpPath, content);
      renameSync(this.tmpPath, this.opts.filePath);
    } catch (err) {
      brakitWarn(`failed to save ${this.opts.label}: ${getErrorMessage(err)}`);
    }
  }

  async writeAsync(content: string): Promise<void> {
    if (this.writing) {
      this.pendingContent = content;
      return;
    }
    this.writing = true;
    try {
      await this.ensureDirAsync();
      await writeFile(this.tmpPath, content);
      await rename(this.tmpPath, this.opts.filePath);
    } catch (err) {
      brakitWarn(`failed to save ${this.opts.label}: ${getErrorMessage(err)}`);
    } finally {
      this.writing = false;
      if (this.pendingContent !== null) {
        const next = this.pendingContent;
        this.pendingContent = null;
        this.writeAsync(next).catch(() => {});
      }
    }
  }

  ensureDir(): void {
    if (!existsSync(this.opts.dir)) {
      mkdirSync(this.opts.dir, { recursive: true });
      if (this.opts.gitignoreEntry) {
        ensureGitignore(this.opts.dir, this.opts.gitignoreEntry);
      }
    }
  }

  private async ensureDirAsync(): Promise<void> {
    if (!(await fileExists(this.opts.dir))) {
      await mkdir(this.opts.dir, { recursive: true });
      if (this.opts.gitignoreEntry) {
        await ensureGitignoreAsync(this.opts.dir, this.opts.gitignoreEntry);
      }
    }
  }
}
