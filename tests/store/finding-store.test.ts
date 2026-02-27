import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { FindingStore } from "../../src/store/finding-store.js";
import { computeFindingId } from "../../src/store/finding-id.js";
import { makeSecurityFinding } from "../helpers/mcp-factories.js";

function makeTmpDir(): string {
  const dir = resolve(tmpdir(), `brakit-test-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("computeFindingId", () => {
  it("returns deterministic IDs for the same input", () => {
    const finding = makeSecurityFinding();
    expect(computeFindingId(finding)).toBe(computeFindingId(finding));
  });

  it("returns different IDs for different rules", () => {
    const a = makeSecurityFinding({ rule: "rule-a" });
    const b = makeSecurityFinding({ rule: "rule-b" });
    expect(computeFindingId(a)).not.toBe(computeFindingId(b));
  });

  it("returns different IDs for different endpoints", () => {
    const a = makeSecurityFinding({ endpoint: "GET /a" });
    const b = makeSecurityFinding({ endpoint: "GET /b" });
    expect(computeFindingId(a)).not.toBe(computeFindingId(b));
  });

  it("returns different IDs for different descriptions", () => {
    const a = makeSecurityFinding({ desc: "desc a" });
    const b = makeSecurityFinding({ desc: "desc b" });
    expect(computeFindingId(a)).not.toBe(computeFindingId(b));
  });

  it("returns a 16-char hex string", () => {
    const id = computeFindingId(makeSecurityFinding());
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("FindingStore", () => {
  let tmpDir: string;
  let store: FindingStore;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    store = new FindingStore(tmpDir);
  });

  afterEach(() => {
    store.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("upsert", () => {
    it("creates a new finding with state open", () => {
      const finding = makeSecurityFinding();
      const result = store.upsert(finding, "passive");

      expect(result.state).toBe("open");
      expect(result.occurrences).toBe(1);
      expect(result.findingId).toBe(computeFindingId(finding));
      expect(result.finding).toBe(finding);
      expect(result.resolvedAt).toBeNull();
    });

    it("increments occurrences on duplicate", () => {
      const finding = makeSecurityFinding();
      store.upsert(finding, "passive");
      const result = store.upsert(finding, "passive");

      expect(result.occurrences).toBe(2);
    });

    it("re-opens a resolved finding when re-seen", () => {
      const finding = makeSecurityFinding();
      const initial = store.upsert(finding, "passive");
      store.transition(initial.findingId, "resolved");

      const reopened = store.upsert(finding, "passive");
      expect(reopened.state).toBe("open");
      expect(reopened.resolvedAt).toBeNull();
    });
  });

  describe("transition", () => {
    it("changes state correctly", () => {
      const finding = makeSecurityFinding();
      const result = store.upsert(finding, "passive");

      store.transition(result.findingId, "fixing");
      expect(store.get(result.findingId)?.state).toBe("fixing");
    });

    it("sets resolvedAt when transitioning to resolved", () => {
      const finding = makeSecurityFinding();
      const result = store.upsert(finding, "passive");

      store.transition(result.findingId, "resolved");
      expect(store.get(result.findingId)?.resolvedAt).toBeTypeOf("number");
    });

    it("returns false for unknown finding ID", () => {
      expect(store.transition("nonexistent", "resolved")).toBe(false);
    });
  });

  describe("reconcilePassive", () => {
    it("auto-resolves absent passive findings", () => {
      const a = makeSecurityFinding({ rule: "rule-a" });
      const b = makeSecurityFinding({ rule: "rule-b" });
      store.upsert(a, "passive");
      store.upsert(b, "passive");

      store.reconcilePassive([a]);

      const bId = computeFindingId(b);
      expect(store.get(bId)?.state).toBe("resolved");
    });

    it("does not resolve findings still in current set", () => {
      const a = makeSecurityFinding({ rule: "rule-a" });
      store.upsert(a, "passive");

      store.reconcilePassive([a]);

      const aId = computeFindingId(a);
      expect(store.get(aId)?.state).toBe("open");
    });
  });

  describe("getAll / getByState / clear", () => {
    it("getAll returns all findings", () => {
      store.upsert(makeSecurityFinding({ rule: "a" }), "passive");
      store.upsert(makeSecurityFinding({ rule: "b" }), "passive");
      expect(store.getAll()).toHaveLength(2);
    });

    it("getByState filters correctly", () => {
      const f = makeSecurityFinding();
      const result = store.upsert(f, "passive");
      store.transition(result.findingId, "resolved");

      expect(store.getByState("open")).toHaveLength(0);
      expect(store.getByState("resolved")).toHaveLength(1);
    });

    it("clear empties the store", () => {
      store.upsert(makeSecurityFinding(), "passive");
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });
  });

  describe("persistence", () => {
    it("round-trips findings through save/load", () => {
      const finding = makeSecurityFinding();
      store.upsert(finding, "passive");
      store.stop();

      const store2 = new FindingStore(tmpDir);
      expect(store2.getAll()).toHaveLength(1);
      expect(store2.getAll()[0].findingId).toBe(computeFindingId(finding));
      store2.stop();
    });

    it("starts fresh if file is corrupt", () => {
      const findingsPath = resolve(tmpDir, ".brakit/findings.json");
      mkdirSync(resolve(tmpDir, ".brakit"), { recursive: true });
      writeFileSync(findingsPath, "{{corrupt json");

      const store2 = new FindingStore(tmpDir);
      expect(store2.getAll()).toHaveLength(0);
      store2.stop();
    });
  });
});
