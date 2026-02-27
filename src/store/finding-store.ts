import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { writeFile, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import type { SecurityFinding } from "../types/index.js";
import type {
  StatefulFinding,
  FindingState,
  FindingSource,
  FindingsData,
} from "../types/finding-lifecycle.js";
import {
  METRICS_DIR,
  FINDINGS_FILE,
  FINDINGS_FLUSH_INTERVAL_MS,
} from "../constants/index.js";
import { ensureGitignore } from "../utils/fs.js";
import { computeFindingId } from "./finding-id.js";

export class FindingStore {
  private findings = new Map<string, StatefulFinding>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private writing = false;
  private readonly findingsPath: string;
  private readonly tmpPath: string;
  private readonly metricsDir: string;

  constructor(private rootDir: string) {
    this.metricsDir = resolve(rootDir, METRICS_DIR);
    this.findingsPath = resolve(rootDir, FINDINGS_FILE);
    this.tmpPath = this.findingsPath + ".tmp";
    this.load();
  }

  start(): void {
    this.flushTimer = setInterval(
      () => this.flush(),
      FINDINGS_FLUSH_INTERVAL_MS,
    );
    this.flushTimer.unref();
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushSync();
  }

  upsert(finding: SecurityFinding, source: FindingSource): StatefulFinding {
    const id = computeFindingId(finding);
    const existing = this.findings.get(id);
    const now = Date.now();

    if (existing) {
      existing.lastSeenAt = now;
      existing.occurrences++;
      existing.finding = finding;
      if (existing.state === "resolved") {
        existing.state = "open";
        existing.resolvedAt = null;
      }
      this.dirty = true;
      return existing;
    }

    const stateful: StatefulFinding = {
      findingId: id,
      state: "open",
      source,
      finding,
      firstSeenAt: now,
      lastSeenAt: now,
      resolvedAt: null,
      occurrences: 1,
    };
    this.findings.set(id, stateful);
    this.dirty = true;
    return stateful;
  }

  transition(findingId: string, state: FindingState): boolean {
    const finding = this.findings.get(findingId);
    if (!finding) return false;
    finding.state = state;
    if (state === "resolved") {
      finding.resolvedAt = Date.now();
    }
    this.dirty = true;
    return true;
  }

  reconcilePassive(currentFindings: readonly SecurityFinding[]): void {
    const currentIds = new Set(currentFindings.map(computeFindingId));

    for (const [id, stateful] of this.findings) {
      if (
        stateful.source === "passive" &&
        stateful.state === "open" &&
        !currentIds.has(id)
      ) {
        stateful.state = "resolved";
        stateful.resolvedAt = Date.now();
        this.dirty = true;
      }
    }
  }

  getAll(): readonly StatefulFinding[] {
    return [...this.findings.values()];
  }

  getByState(state: FindingState): readonly StatefulFinding[] {
    return [...this.findings.values()].filter((f) => f.state === state);
  }

  get(findingId: string): StatefulFinding | undefined {
    return this.findings.get(findingId);
  }

  clear(): void {
    this.findings.clear();
    this.dirty = true;
  }

  private load(): void {
    try {
      if (existsSync(this.findingsPath)) {
        const raw = readFileSync(this.findingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && Array.isArray(parsed.findings)) {
          for (const f of parsed.findings as StatefulFinding[]) {
            this.findings.set(f.findingId, f);
          }
        }
      }
    } catch {
      // Start fresh if file is corrupt
    }
  }

  private flush(): void {
    if (!this.dirty) return;
    this.writeAsync();
  }

  private flushSync(): void {
    if (!this.dirty) return;
    try {
      this.ensureDir();
      const data: FindingsData = {
        version: 1,
        findings: [...this.findings.values()],
      };
      writeFileSync(this.tmpPath, JSON.stringify(data));
      renameSync(this.tmpPath, this.findingsPath);
      this.dirty = false;
    } catch (err) {
      process.stderr.write(
        `[brakit] failed to save findings: ${(err as Error).message}\n`,
      );
    }
  }

  private async writeAsync(): Promise<void> {
    if (this.writing) return;
    this.writing = true;
    try {
      if (!existsSync(this.metricsDir)) {
        await mkdir(this.metricsDir, { recursive: true });
        ensureGitignore(this.metricsDir, METRICS_DIR);
      }
      const data: FindingsData = {
        version: 1,
        findings: [...this.findings.values()],
      };
      await writeFile(this.tmpPath, JSON.stringify(data));
      await rename(this.tmpPath, this.findingsPath);
      this.dirty = false;
    } catch (err) {
      process.stderr.write(
        `[brakit] failed to save findings: ${(err as Error).message}\n`,
      );
    } finally {
      this.writing = false;
      if (this.dirty) this.writeAsync();
    }
  }

  private ensureDir(): void {
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true });
      ensureGitignore(this.metricsDir, METRICS_DIR);
    }
  }
}
