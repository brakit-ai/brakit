import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { IssueStore } from "../../src/store/issue-store.js";
import { computeIssueId } from "../../src/utils/issue-id.js";
import type { Issue } from "../../src/types/issue-lifecycle.js";

function makeTmpDir(): string {
  const dir = resolve(tmpdir(), `brakit-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    category: "security",
    rule: "test-rule",
    severity: "warning",
    title: "Test Finding",
    desc: "A test finding description",
    hint: "Fix by doing X",
    endpoint: "GET /api/test",
    ...overrides,
  };
}

describe("computeIssueId", () => {
  it("returns deterministic IDs for the same input", () => {
    const issue = makeIssue();
    expect(computeIssueId(issue)).toBe(computeIssueId(issue));
  });

  it("returns different IDs for different rules", () => {
    const a = makeIssue({ rule: "rule-a" });
    const b = makeIssue({ rule: "rule-b" });
    expect(computeIssueId(a)).not.toBe(computeIssueId(b));
  });

  it("returns different IDs for different endpoints", () => {
    const a = makeIssue({ endpoint: "GET /a" });
    const b = makeIssue({ endpoint: "GET /b" });
    expect(computeIssueId(a)).not.toBe(computeIssueId(b));
  });

  it("returns different IDs for different descriptions", () => {
    const a = makeIssue({ desc: "desc a" });
    const b = makeIssue({ desc: "desc b" });
    expect(computeIssueId(a)).not.toBe(computeIssueId(b));
  });

  it("returns a 16-char hex string", () => {
    const id = computeIssueId(makeIssue());
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("IssueStore", () => {
  let tmpDir: string;
  let store: IssueStore;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    store = new IssueStore(tmpDir);
  });

  afterEach(() => {
    store.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("upsert", () => {
    it("creates a new issue with state open", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");

      expect(result.state).toBe("open");
      expect(result.occurrences).toBe(1);
      expect(result.issueId).toBe(computeIssueId(issue));
      expect(result.issue).toBe(issue);
      expect(result.resolvedAt).toBeNull();
      expect(result.cleanHitsSinceLastSeen).toBe(0);
    });

    it("increments occurrences on duplicate", () => {
      const issue = makeIssue();
      store.upsert(issue, "passive");
      const result = store.upsert(issue, "passive");

      expect(result.occurrences).toBe(2);
    });

    it("resets cleanHitsSinceLastSeen on re-detection", () => {
      const issue = makeIssue();
      const initial = store.upsert(issue, "passive");

      // Simulate some clean hits
      store.reconcile(new Set(), new Set(["GET /api/test"]));
      expect(store.get(initial.issueId)!.cleanHitsSinceLastSeen).toBe(1);

      // Re-detect
      store.upsert(issue, "passive");
      expect(store.get(initial.issueId)!.cleanHitsSinceLastSeen).toBe(0);
    });

    it("transitions resolved issue to regressed when re-seen", () => {
      const issue = makeIssue();
      const initial = store.upsert(issue, "passive");
      store.transition(initial.issueId, "resolved");

      const reopened = store.upsert(issue, "passive");
      expect(reopened.state).toBe("regressed");
      expect(reopened.resolvedAt).toBeNull();
    });

    it("transitions stale issue to regressed when re-seen", () => {
      const issue = makeIssue();
      const initial = store.upsert(issue, "passive");

      // Manually set to stale
      store.transition(initial.issueId, "resolved");
      const staleIssue = store.get(initial.issueId)!;
      staleIssue.state = "stale";

      const reopened = store.upsert(issue, "passive");
      expect(reopened.state).toBe("regressed");
    });
  });

  describe("transition", () => {
    it("changes state correctly", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");

      store.transition(result.issueId, "fixing");
      expect(store.get(result.issueId)?.state).toBe("fixing");
    });

    it("sets resolvedAt when transitioning to resolved", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");

      store.transition(result.issueId, "resolved");
      expect(store.get(result.issueId)?.resolvedAt).toBeTypeOf("number");
    });

    it("returns false for unknown issue ID", () => {
      expect(store.transition("nonexistent", "resolved")).toBe(false);
    });
  });

  describe("reportFix", () => {
    it("sets aiStatus and aiNotes on existing issue", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");

      store.reportFix(result.issueId, "fixed", "wrapped in useCallback");

      const updated = store.get(result.issueId)!;
      expect(updated.aiStatus).toBe("fixed");
      expect(updated.aiNotes).toBe("wrapped in useCallback");
    });

    it("transitions to 'fixing' state when status is 'fixed'", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");

      store.reportFix(result.issueId, "fixed", "applied fix");

      expect(store.get(result.issueId)?.state).toBe("fixing");
    });

    it("keeps state unchanged when status is 'wont_fix'", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");

      store.reportFix(result.issueId, "wont_fix", "third-party issue");

      expect(store.get(result.issueId)?.state).toBe("open");
      expect(store.get(result.issueId)?.aiStatus).toBe("wont_fix");
    });

    it("returns false for unknown issue ID", () => {
      expect(store.reportFix("nonexistent", "fixed", "done")).toBe(false);
    });
  });

  describe("reconcile", () => {
    it("increments cleanHitsSinceLastSeen when endpoint is active but issue absent", () => {
      const issue = makeIssue({ endpoint: "GET /api/users" });
      const result = store.upsert(issue, "passive");

      store.reconcile(new Set(), new Set(["GET /api/users"]));

      expect(store.get(result.issueId)!.cleanHitsSinceLastSeen).toBe(1);
      expect(store.get(result.issueId)!.state).toBe("open");
    });

    it("resolves issue after enough clean hits", () => {
      const issue = makeIssue({ endpoint: "GET /api/users" });
      const result = store.upsert(issue, "passive");

      // Hit endpoint 5 times without reproducing
      for (let i = 0; i < 5; i++) {
        store.reconcile(new Set(), new Set(["GET /api/users"]));
      }

      expect(store.get(result.issueId)!.state).toBe("resolved");
      expect(store.get(result.issueId)!.resolvedAt).toBeTypeOf("number");
    });

    it("does not resolve when endpoint is not active", () => {
      const issue = makeIssue({ endpoint: "GET /api/users" });
      const result = store.upsert(issue, "passive");

      // Endpoint not in active set
      store.reconcile(new Set(), new Set(["GET /api/other"]));

      expect(store.get(result.issueId)!.state).toBe("open");
      expect(store.get(result.issueId)!.cleanHitsSinceLastSeen).toBe(0);
    });

    it("does not touch issues still in current set", () => {
      const issue = makeIssue({ endpoint: "GET /api/users" });
      const result = store.upsert(issue, "passive");

      store.reconcile(new Set([result.issueId]), new Set(["GET /api/users"]));

      expect(store.get(result.issueId)!.state).toBe("open");
      expect(store.get(result.issueId)!.cleanHitsSinceLastSeen).toBe(0);
    });

    it("marks issue as stale when inactive for too long", () => {
      const issue = makeIssue({ endpoint: "GET /api/users" });
      const result = store.upsert(issue, "passive");

      // Manually backdate lastSeenAt to simulate staleness
      const stateful = store.get(result.issueId)!;
      stateful.lastSeenAt = Date.now() - 31 * 60 * 1000; // 31 minutes ago

      store.reconcile(new Set(), new Set());

      expect(store.get(result.issueId)!.state).toBe("stale");
    });

    it("reconciles fixing state the same as open", () => {
      const issue = makeIssue({ endpoint: "GET /api/users" });
      const result = store.upsert(issue, "passive");
      store.reportFix(result.issueId, "fixed", "applied fix");
      expect(store.get(result.issueId)?.state).toBe("fixing");

      // 5 clean hits should resolve
      for (let i = 0; i < 5; i++) {
        store.reconcile(new Set(), new Set(["GET /api/users"]));
      }

      expect(store.get(result.issueId)?.state).toBe("resolved");
    });
  });

  describe("getAll / getByState / getByCategory / clear", () => {
    it("getAll returns all issues", () => {
      store.upsert(makeIssue({ rule: "a" }), "passive");
      store.upsert(makeIssue({ rule: "b" }), "passive");
      expect(store.getAll()).toHaveLength(2);
    });

    it("getByState filters correctly", () => {
      const issue = makeIssue();
      const result = store.upsert(issue, "passive");
      store.transition(result.issueId, "resolved");

      expect(store.getByState("open")).toHaveLength(0);
      expect(store.getByState("resolved")).toHaveLength(1);
    });

    it("getByCategory filters correctly", () => {
      store.upsert(makeIssue({ category: "security", rule: "sec-1" }), "passive");
      store.upsert(makeIssue({ category: "performance", rule: "perf-1" }), "passive");

      expect(store.getByCategory("security")).toHaveLength(1);
      expect(store.getByCategory("performance")).toHaveLength(1);
    });

    it("clear empties the store", () => {
      store.upsert(makeIssue(), "passive");
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe("persistence", () => {
    it("round-trips issues through save/load", () => {
      const issue = makeIssue();
      store.upsert(issue, "passive");
      store.stop();

      const store2 = new IssueStore(tmpDir);
      store2.loadSync();
      expect(store2.getAll()).toHaveLength(1);
      expect(store2.getAll()[0].issueId).toBe(computeIssueId(issue));
      store2.stop();
    });

    it("clear deletes the persistence file", () => {
      store.upsert(makeIssue(), "passive");
      store.stop(); // flush to disk

      const issuesPath = resolve(tmpDir, "issues.json");
      expect(existsSync(issuesPath)).toBe(true);

      store = new IssueStore(tmpDir);
      store.loadSync();
      expect(store.getAll()).toHaveLength(1);

      store.clear();
      expect(store.getAll()).toHaveLength(0);
      expect(existsSync(issuesPath)).toBe(false);
    });

    it("clear prevents stale data from reloading", () => {
      store.upsert(makeIssue(), "passive");
      store.stop(); // flush to disk

      store = new IssueStore(tmpDir);
      store.loadSync();
      store.clear();

      // Simulate reload: new store should find no file
      const store2 = new IssueStore(tmpDir);
      store2.loadSync();
      expect(store2.getAll()).toHaveLength(0);
      store2.stop();
    });

    it("starts fresh if file is corrupt", () => {
      const issuesPath = resolve(tmpDir, "issues.json");
      writeFileSync(issuesPath, "{{corrupt json");

      const store2 = new IssueStore(tmpDir);
      store2.loadSync();
      expect(store2.getAll()).toHaveLength(0);
      store2.stop();
    });

    it("starts fresh if file has wrong version", () => {
      const issuesPath = resolve(tmpDir, "issues.json");
      writeFileSync(issuesPath, JSON.stringify({ version: 999, issues: [] }));

      const store2 = new IssueStore(tmpDir);
      store2.loadSync();
      expect(store2.getAll()).toHaveLength(0);
      store2.stop();
    });

    it("starts fresh if issues array is missing", () => {
      const issuesPath = resolve(tmpDir, "issues.json");
      writeFileSync(issuesPath, JSON.stringify({ version: 2 }));

      const store2 = new IssueStore(tmpDir);
      store2.loadSync();
      expect(store2.getAll()).toHaveLength(0);
      store2.stop();
    });
  });
});
