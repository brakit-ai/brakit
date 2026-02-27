import { createHash } from "node:crypto";
import type { SecurityFinding } from "../types/index.js";

/**
 * Compute a stable finding ID by hashing rule + endpoint + description.
 * Uses SHA-256 truncated to 16 hex chars (64 bits), providing sufficient
 * uniqueness for the expected finding cardinality (< 1000 concurrent findings).
 * The triple (rule, endpoint, desc) is chosen because:
 * - `rule` distinguishes finding type (e.g., "sql-injection" vs "n-plus-one")
 * - `endpoint` distinguishes location
 * - `desc` distinguishes specific instance within the same rule+endpoint
 */
export function computeFindingId(finding: SecurityFinding): string {
  const key = `${finding.rule}:${finding.endpoint}:${finding.desc}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}
