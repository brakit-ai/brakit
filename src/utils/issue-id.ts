import { createHash } from "node:crypto";
import type { Issue } from "../types/issue-lifecycle.js";
import { ISSUE_ID_HASH_LENGTH } from "../constants/config.js";

/**
 * Compute a stable issue ID by hashing rule + endpoint + description.
 * Uses SHA-256 truncated to 16 hex chars (64 bits), providing sufficient
 * uniqueness for the expected issue cardinality (< 1000 concurrent issues).
 * The triple (rule, endpoint, desc) is chosen because:
 * - `rule` distinguishes issue type (e.g., "exposed-secret" vs "n1")
 * - `endpoint` distinguishes location
 * - `desc` distinguishes specific instance within the same rule+endpoint
 */
export function computeIssueId(issue: Issue): string {
  // Normalize dynamic values so the same logical issue always produces the same ID.
  const stableDesc = issue.desc.replace(/\d[\d,.]*\s*\w*/g, "#");
  const key = `${issue.rule}:${issue.endpoint ?? "global"}:${stableDesc}`;
  return createHash("sha256").update(key).digest("hex").slice(0, ISSUE_ID_HASH_LENGTH);
}
