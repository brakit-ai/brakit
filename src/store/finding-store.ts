import { readFile } from "node:fs/promises";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileExists } from "../utils/fs.js";
import type { SecurityFinding } from "../types/index.js";
import type {
  StatefulFinding,
  FindingState,
  FindingSource,
  FindingsData,
  AiFixStatus,
} from "../types/finding-lifecycle.js";
import {
  FINDINGS_FILE,
  FINDINGS_FLUSH_INTERVAL_MS,
} from "../constants/index.js";
import { FINDINGS_DATA_VERSION } from "../constants/limits.js";
import { AtomicWriter } from "../utils/atomic-writer.js";
import { brakitDebug } from "../utils/log.js";
import { validateFindingsData } from "../utils/type-guards.js";
import { computeFindingId } from "./finding-id.js";

export class FindingStore {
  private findings = new Map<string, StatefulFinding>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private readonly writer: AtomicWriter;
  private readonly findingsPath: string;

  constructor(private dataDir: string) {
    this.findingsPath = resolve(dataDir, FINDINGS_FILE);
    this.writer = new AtomicWriter({
      dir: dataDir,
      filePath: this.findingsPath,
      label: "findings",
    });
  }

  start(): void {
    this.loadAsync().catch((err) => brakitDebug(`FindingStore: async load failed: ${err}`));
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
      aiStatus: null,
      aiNotes: null,
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

  reportFix(findingId: string, status: AiFixStatus, notes: string): boolean {
    const finding = this.findings.get(findingId);
    if (!finding) return false;

    finding.aiStatus = status;
    finding.aiNotes = notes;

    // "fixed" → "fixing": the fix was applied but needs verification by the
    // next analysis pass. reconcilePassive() transitions to "resolved" once
    // the finding no longer appears in scan results.
    if (status === "fixed") {
      finding.state = "fixing";
    }

    this.dirty = true;
    return true;
  }

  /**
   * Reconcile passive findings against the current analysis results.
   *
   * Passive findings are detected by continuous scanning (not user-triggered).
   * When a previously-seen finding is absent from the current results, it means
   * the issue has been fixed — transition it to "resolved" automatically.
   * Active findings (from MCP verify-fix) are not auto-resolved because they
   * require explicit verification.
   */
  reconcilePassive(currentFindings: readonly SecurityFinding[]): void {
    const currentIds = new Set(currentFindings.map(computeFindingId));

    for (const [id, stateful] of this.findings) {
      if (
        stateful.source === "passive" &&
        (stateful.state === "open" || stateful.state === "fixing") &&
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
    this.dirty = false;
    try {
      if (existsSync(this.findingsPath)) {
        unlinkSync(this.findingsPath);
      }
    } catch { /* non-critical */ }
  }

  private async loadAsync(): Promise<void> {
    try {
      if (await fileExists(this.findingsPath)) {
        const raw = await readFile(this.findingsPath, "utf-8");
        this.hydrate(raw);
      }
    } catch (err) {
      brakitDebug(`FindingStore: could not load findings file, starting fresh: ${err}`);
    }
  }

  /** Sync load for tests only — not used in production paths. */
  loadSync(): void {
    try {
      if (existsSync(this.findingsPath)) {
        const raw = readFileSync(this.findingsPath, "utf-8");
        this.hydrate(raw);
      }
    } catch (err) {
      brakitDebug(`FindingStore: could not load findings file, starting fresh: ${err}`);
    }
  }

  /** Parse and populate findings from a raw JSON string. */
  private hydrate(raw: string): void {
    const validated = validateFindingsData(JSON.parse(raw));
    if (!validated) return;
    for (const f of validated.findings) {
      this.findings.set(f.findingId, f);
    }
  }

  private flush(): void {
    if (!this.dirty) return;
    this.writer.writeAsync(this.serialize());
    this.dirty = false;
  }

  private flushSync(): void {
    if (!this.dirty) return;
    this.writer.writeSync(this.serialize());
    // Clear after write — if writeSync throws before AtomicWriter catches,
    // the next flush will correctly retry.
    this.dirty = false;
  }

  private serialize(): string {
    const data: FindingsData = {
      version: FINDINGS_DATA_VERSION,
      findings: [...this.findings.values()],
    };
    return JSON.stringify(data);
  }
}
