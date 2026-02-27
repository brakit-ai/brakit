import { describe, it, expect } from "vitest";
import { pgAdapter } from "../../src/instrument/adapters/pg.js";
import { mysql2Adapter } from "../../src/instrument/adapters/mysql2.js";
import { prismaAdapter } from "../../src/instrument/adapters/prisma.js";
import type { BrakitAdapter } from "../../src/instrument/adapter.js";

/**
 * Contract tests that every BrakitAdapter must pass.
 * These run against the real adapter objects without mocking,
 * validating interface compliance and safe failure behavior
 * when the target library is not installed.
 */
function runContractTests(adapter: BrakitAdapter) {
  describe(`${adapter.name} contract`, () => {
    it("has a non-empty name", () => {
      expect(adapter.name).toBeTruthy();
      expect(typeof adapter.name).toBe("string");
    });

    it("detect() returns a boolean", () => {
      const result = adapter.detect();
      expect(typeof result).toBe("boolean");
    });

    it("detect() returns false when library is not installed", () => {
      // In the test environment, pg/mysql2/prisma are not installed
      expect(adapter.detect()).toBe(false);
    });

    it("patch() does not throw when library is not available", () => {
      const emit = () => {};
      expect(() => adapter.patch(emit)).not.toThrow();
    });

    it("unpatch() does not throw when not patched", () => {
      if (adapter.unpatch) {
        expect(() => adapter.unpatch!()).not.toThrow();
      }
    });
  });
}

describe("adapter contracts", () => {
  runContractTests(pgAdapter);
  runContractTests(mysql2Adapter);
  runContractTests(prismaAdapter);
});
