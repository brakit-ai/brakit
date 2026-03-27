export type NormalizedOp = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";

const VALID_OPS = new Set<string>(["SELECT", "INSERT", "UPDATE", "DELETE"]);

/**
 * Table extraction regex — handles both qualified and unqualified names:
 *   FROM users              → "users"
 *   FROM public.users       → "users"
 *   FROM "public"."User"    → "User"
 *   INSERT INTO orders      → "orders"
 *   UPDATE public.users     → "users"
 *
 * Does not handle: backtick quoting (MySQL), bracket quoting (SQL Server),
 * subqueries as table sources, CTEs, or multi-table operations.
 */
const TABLE_RE = /(?:FROM|INTO|UPDATE)\s+(?:"?\w+"?\.)?"?(\w+)"?/i;

/**
 * Extracts the operation type (SELECT/INSERT/UPDATE/DELETE) and target table
 * from a raw SQL string. Used to group and label database queries in telemetry.
 */
export function normalizeSQL(sql: string): { op: NormalizedOp; table: string } {
  if (!sql) return { op: "OTHER", table: "" };

  const trimmed = sql.trim();
  let spaceIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { spaceIdx = i; break; }
  }
  const keyword = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toUpperCase();
  const op: NormalizedOp = VALID_OPS.has(keyword) ? (keyword as NormalizedOp) : "OTHER";
  const table = trimmed.match(TABLE_RE)?.[1] ?? "";

  return { op, table };
}

// ── Prisma operation mapping ──

const PRISMA_OP_MAP: Record<string, NormalizedOp> = {
  findUnique: "SELECT",
  findUniqueOrThrow: "SELECT",
  findFirst: "SELECT",
  findFirstOrThrow: "SELECT",
  findMany: "SELECT",
  count: "SELECT",
  aggregate: "SELECT",
  groupBy: "SELECT",
  create: "INSERT",
  createMany: "INSERT",
  createManyAndReturn: "INSERT",
  update: "UPDATE",
  updateMany: "UPDATE",
  upsert: "UPDATE",
  delete: "DELETE",
  deleteMany: "DELETE",
};

export function normalizePrismaOp(operation: string): NormalizedOp {
  return PRISMA_OP_MAP[operation] ?? "OTHER";
}

// ── Query parameter normalization ──

const SQL_PARAM_MARKER = /\$\d+/g;
const SQL_STRING_LITERAL = /'[^']*'/g;
const SQL_NUMBER_LITERAL = /\b\d+(\.\d+)?\b/g;

/**
 * Replaces parameter markers ($1, $2), string literals, and numbers with `?`
 * to group queries by shape regardless of parameter values.
 */
export function normalizeQueryParams(sql: string): string | null {
  if (!sql) return null;
  return sql
    .replace(SQL_PARAM_MARKER, "?")
    .replace(SQL_STRING_LITERAL, "?")
    .replace(SQL_NUMBER_LITERAL, "?");
}
