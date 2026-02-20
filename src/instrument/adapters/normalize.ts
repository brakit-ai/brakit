export type NormalizedOp = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";

export function normalizeSQL(sql: string): { op: NormalizedOp; table: string } {
  if (!sql) return { op: "OTHER", table: "" };
  const trimmed = sql.trim();
  const op = trimmed.split(/\s+/)[0].toUpperCase();

  if (/SELECT\s+COUNT/i.test(trimmed)) {
    const match = trimmed.match(/FROM\s+"?\w+"?\."?(\w+)"?/i);
    return { op: "SELECT", table: match?.[1] ?? "" };
  }

  const tableMatch = trimmed.match(/(?:FROM|INTO|UPDATE)\s+"?\w+"?\."?(\w+)"?/i);
  const table = tableMatch?.[1] ?? "";

  switch (op) {
    case "SELECT": return { op: "SELECT", table };
    case "INSERT": return { op: "INSERT", table };
    case "UPDATE": return { op: "UPDATE", table };
    case "DELETE": return { op: "DELETE", table };
    default: return { op: "OTHER", table };
  }
}

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

export function normalizeQueryParams(sql: string): string | null {
  if (!sql) return null;
  let n = sql.replace(/'[^']*'/g, "?");
  n = n.replace(/\b\d+(\.\d+)?\b/g, "?");
  n = n.replace(/\$\d+/g, "?");
  return n;
}
