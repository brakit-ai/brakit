import type { TracedQuery } from "../../types/index.js";
import { normalizeQueryParams, normalizeSQL } from "../../instrument/adapters/normalize.js";

export function getQueryShape(q: TracedQuery): string {
  if (q.sql) return normalizeQueryParams(q.sql) ?? "";
  return `${q.operation ?? q.normalizedOp ?? "?"}:${q.model ?? q.table ?? ""}`;
}

export function getQueryInfo(q: TracedQuery): { op: string; table: string } {
  if (q.sql) return normalizeSQL(q.sql);
  return {
    op: q.normalizedOp ?? q.operation ?? "?",
    table: q.table ?? q.model ?? "",
  };
}
