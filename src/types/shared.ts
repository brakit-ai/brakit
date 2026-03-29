/**
 * Canonical type definitions shared between server and browser client.
 *
 * Both `src/types/telemetry.ts` (server) and
 * `src/dashboard/client/store/types.ts` (browser) import from here.
 * This is the single source of truth for union types used across the
 * bundling boundary.
 */

// ── Primitives ──────────────────────────────────────────────────────

export type DbDriver =
  | "pg"
  | "mysql2"
  | "prisma"
  | "asyncpg"
  | "sqlalchemy"
  | "sdk";

export type LogLevel = "log" | "warn" | "error" | "info" | "debug";

export type NormalizedOp = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";

export type Severity = "critical" | "warning" | "info";

// ── Issue lifecycle ─────────────────────────────────────────────────

/**
 * State machine for issue lifecycle:
 *
 *   open ──→ fixing ──→ resolved
 *     │         │           │
 *     │         ▼           ▼
 *     │       regressed   (pruned after PRUNE_ISSUE_TTL_MS)
 *     │
 *     └──→ stale (no traffic for STALE_ISSUE_TTL_MS)
 */
export type IssueState = "open" | "fixing" | "resolved" | "stale" | "regressed";

export type IssueSource = "passive";

export type IssueCategory = "security" | "performance" | "reliability";

export type AiFixStatus = "fixed" | "wont_fix";

// ── Source location ─────────────────────────────────────────────────

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  fn?: string;
}
