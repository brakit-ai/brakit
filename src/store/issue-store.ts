import { readFile } from "node:fs/promises";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileExists } from "../utils/fs.js";
import type { Issue, StatefulIssue, IssueState, IssueSource, IssueCategory, IssuesData, AiFixStatus } from "../types/issue-lifecycle.js";
import { ISSUES_FILE, ISSUES_FLUSH_INTERVAL_MS, ISSUES_DATA_VERSION, CLEAN_HITS_FOR_RESOLUTION, STALE_ISSUE_TTL_MS, ISSUE_PRUNE_TTL_MS } from "../constants/config.js";
import { AtomicWriter } from "../utils/atomic-writer.js";
import { brakitDebug } from "../utils/log.js";
import { validateIssuesData } from "../utils/type-guards.js";
import { computeIssueId } from "../utils/issue-id.js";

export class IssueStore {
  private issues = new Map<string, StatefulIssue>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;
  private readonly writer: AtomicWriter;
  private readonly issuesPath: string;

  constructor(private dataDir: string) {
    this.issuesPath = resolve(dataDir, ISSUES_FILE);
    this.writer = new AtomicWriter({
      dir: dataDir,
      filePath: this.issuesPath,
      label: "issues",
    });
  }

  start(): void {
    this.loadAsync().catch((err) => brakitDebug(`IssueStore: async load failed: ${err}`));
    this.flushTimer = setInterval(
      () => this.flush(),
      ISSUES_FLUSH_INTERVAL_MS,
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

  upsert(issue: Issue, source: IssueSource): StatefulIssue {
    const id = computeIssueId(issue);
    const existing = this.issues.get(id);
    const now = Date.now();

    if (existing) {
      existing.lastSeenAt = now;
      existing.occurrences++;
      existing.issue = issue;
      existing.cleanHitsSinceLastSeen = 0;
      if (existing.state === "resolved" || existing.state === "stale") {
        existing.state = "regressed";
        existing.resolvedAt = null;
      }
      this.dirty = true;
      return existing;
    }

    const stateful: StatefulIssue = {
      issueId: id,
      state: "open",
      source,
      category: issue.category,
      issue,
      firstSeenAt: now,
      lastSeenAt: now,
      resolvedAt: null,
      occurrences: 1,
      cleanHitsSinceLastSeen: 0,
      aiStatus: null,
      aiNotes: null,
    };
    this.issues.set(id, stateful);
    this.dirty = true;
    return stateful;
  }

  /**
   * Reconcile issues against the current analysis results using evidence-based resolution.
   *
   * @param currentIssueIds - IDs of issues detected in the current analysis cycle
   * @param activeEndpoints - Endpoints that had requests in the current cycle
   */
  reconcile(currentIssueIds: Set<string>, activeEndpoints: Set<string>): void {
    const now = Date.now();

    for (const [, stateful] of this.issues) {
      const isActive = stateful.state === "open" || stateful.state === "fixing" || stateful.state === "regressed";
      if (!isActive) continue;
      if (currentIssueIds.has(stateful.issueId)) continue;

      // Issue was not detected in this cycle
      const endpoint = stateful.issue.endpoint;

      if (endpoint && activeEndpoints.has(endpoint)) {
        // Endpoint was hit but issue did not reproduce → positive evidence
        stateful.cleanHitsSinceLastSeen++;
        if (stateful.cleanHitsSinceLastSeen >= CLEAN_HITS_FOR_RESOLUTION) {
          stateful.state = "resolved";
          stateful.resolvedAt = now;
        }
        this.dirty = true;
      } else if (now - stateful.lastSeenAt > STALE_ISSUE_TTL_MS) {
        // Endpoint hasn't been hit for a long time → stale
        stateful.state = "stale";
        this.dirty = true;
      }
      // Otherwise: endpoint not hit, no evidence → keep current state
    }

    // Prune issues that have been resolved or stale for longer than the TTL
    for (const [id, stateful] of this.issues) {
      if (stateful.state === "resolved" && stateful.resolvedAt && now - stateful.resolvedAt > ISSUE_PRUNE_TTL_MS) {
        this.issues.delete(id);
        this.dirty = true;
      } else if (stateful.state === "stale" && now - stateful.lastSeenAt > STALE_ISSUE_TTL_MS + ISSUE_PRUNE_TTL_MS) {
        this.issues.delete(id);
        this.dirty = true;
      }
    }
  }

  transition(issueId: string, state: IssueState): boolean {
    const issue = this.issues.get(issueId);
    if (!issue) return false;
    issue.state = state;
    if (state === "resolved") {
      issue.resolvedAt = Date.now();
    }
    this.dirty = true;
    return true;
  }

  reportFix(issueId: string, status: AiFixStatus, notes: string): boolean {
    const issue = this.issues.get(issueId);
    if (!issue) return false;

    issue.aiStatus = status;
    issue.aiNotes = notes;

    if (status === "fixed") {
      issue.state = "fixing";
    }

    this.dirty = true;
    return true;
  }

  getAll(): readonly StatefulIssue[] {
    return [...this.issues.values()];
  }

  getByState(state: IssueState): readonly StatefulIssue[] {
    return [...this.issues.values()].filter((i) => i.state === state);
  }

  getByCategory(category: IssueCategory): readonly StatefulIssue[] {
    return [...this.issues.values()].filter((i) => i.category === category);
  }

  get(issueId: string): StatefulIssue | undefined {
    return this.issues.get(issueId);
  }

  clear(): void {
    this.issues.clear();
    this.dirty = false;
    try {
      if (existsSync(this.issuesPath)) {
        unlinkSync(this.issuesPath);
      }
    } catch { /* non-critical */ }
  }

  isDirty(): boolean {
    return this.dirty;
  }

  private async loadAsync(): Promise<void> {
    try {
      if (await fileExists(this.issuesPath)) {
        const raw = await readFile(this.issuesPath, "utf-8");
        this.hydrate(raw);
      }
    } catch (err) {
      brakitDebug(`IssueStore: could not load issues file, starting fresh: ${err}`);
    }
  }

  /** Sync load for tests only — not used in production paths. */
  loadSync(): void {
    try {
      if (existsSync(this.issuesPath)) {
        const raw = readFileSync(this.issuesPath, "utf-8");
        this.hydrate(raw);
      }
    } catch (err) {
      brakitDebug(`IssueStore: could not load issues file, starting fresh: ${err}`);
    }
  }

  /** Parse and populate issues from a raw JSON string. */
  private hydrate(raw: string): void {
    const validated = validateIssuesData(JSON.parse(raw));
    if (!validated) return;
    for (const issue of validated.issues) {
      this.issues.set(issue.issueId, issue);
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
    this.dirty = false;
  }

  private serialize(): string {
    const data: IssuesData = {
      version: ISSUES_DATA_VERSION,
      issues: [...this.issues.values()],
    };
    return JSON.stringify(data);
  }
}
