import { describe, it, expect } from "vitest";
import {
  normalizeSQL,
  normalizePrismaOp,
  normalizeQueryParams,
} from "../../src/instrument/adapters/normalize.js";

describe("normalizeSQL", () => {
  it("detects SELECT with schema-qualified table", () => {
    const result = normalizeSQL("SELECT * FROM public.users WHERE id = $1");
    expect(result.op).toBe("SELECT");
    expect(result.table).toBe("users");
  });

  it("detects INSERT with schema-qualified table", () => {
    const result = normalizeSQL('INSERT INTO public.orders (user_id, total) VALUES ($1, $2)');
    expect(result.op).toBe("INSERT");
    expect(result.table).toBe("orders");
  });

  it("detects UPDATE with schema-qualified table", () => {
    const result = normalizeSQL("UPDATE public.users SET name = $1 WHERE id = $2");
    expect(result.op).toBe("UPDATE");
    expect(result.table).toBe("users");
  });

  it("detects DELETE with schema-qualified table", () => {
    const result = normalizeSQL("DELETE FROM public.sessions WHERE expired_at < NOW()");
    expect(result.op).toBe("DELETE");
    expect(result.table).toBe("sessions");
  });

  it("handles SELECT COUNT separately", () => {
    const result = normalizeSQL("SELECT COUNT(*) FROM public.users WHERE active = true");
    expect(result.op).toBe("SELECT");
    expect(result.table).toBe("users");
  });

  it("handles quoted table names", () => {
    const result = normalizeSQL('SELECT * FROM "public"."User" WHERE id = $1');
    expect(result.op).toBe("SELECT");
    expect(result.table).toBe("User");
  });

  it("is case-insensitive for keywords", () => {
    const result = normalizeSQL("select * from public.users where id = $1");
    expect(result.op).toBe("SELECT");
    expect(result.table).toBe("users");
  });

  it("returns OTHER for unknown operations", () => {
    const result = normalizeSQL("EXPLAIN SELECT * FROM public.users");
    expect(result.op).toBe("OTHER");
  });

  it("returns OTHER with empty table for empty string", () => {
    const result = normalizeSQL("");
    expect(result.op).toBe("OTHER");
    expect(result.table).toBe("");
  });

  it("returns empty table when no schema-qualified name is found", () => {
    const result = normalizeSQL("SELECT * FROM users WHERE id = 1");
    expect(result.op).toBe("SELECT");
    expect(result.table).toBe("");
  });

  it("trims whitespace before parsing", () => {
    const result = normalizeSQL("  SELECT * FROM public.users  ");
    expect(result.op).toBe("SELECT");
    expect(result.table).toBe("users");
  });
});

describe("normalizePrismaOp", () => {
  it.each([
    ["findUnique", "SELECT"],
    ["findUniqueOrThrow", "SELECT"],
    ["findFirst", "SELECT"],
    ["findFirstOrThrow", "SELECT"],
    ["findMany", "SELECT"],
    ["count", "SELECT"],
    ["aggregate", "SELECT"],
    ["groupBy", "SELECT"],
    ["create", "INSERT"],
    ["createMany", "INSERT"],
    ["createManyAndReturn", "INSERT"],
    ["update", "UPDATE"],
    ["updateMany", "UPDATE"],
    ["upsert", "UPDATE"],
    ["delete", "DELETE"],
    ["deleteMany", "DELETE"],
  ] as const)("maps %s to %s", (prismaOp, expected) => {
    expect(normalizePrismaOp(prismaOp)).toBe(expected);
  });

  it("returns OTHER for unknown operations", () => {
    expect(normalizePrismaOp("$connect")).toBe("OTHER");
    expect(normalizePrismaOp("unknown")).toBe("OTHER");
  });
});

describe("normalizeQueryParams", () => {
  it("replaces string literals with ?", () => {
    expect(normalizeQueryParams("SELECT * FROM users WHERE name = 'Alice'")).toBe(
      "SELECT * FROM users WHERE name = ?",
    );
  });

  it("replaces numeric literals with ?", () => {
    expect(normalizeQueryParams("SELECT * FROM users WHERE id = 42")).toBe(
      "SELECT * FROM users WHERE id = ?",
    );
  });

  it("replaces digit portion of positional parameters ($1, $2)", () => {
    // Numeric regex runs before $N regex, so $1 becomes $? (digit replaced, $ kept)
    expect(normalizeQueryParams("SELECT * FROM users WHERE id = $1 AND org = $2")).toBe(
      "SELECT * FROM users WHERE id = $? AND org = $?",
    );
  });

  it("replaces decimal numbers as a whole", () => {
    // 9.99 matched as \d+(\.\d+)? → single "?"
    expect(normalizeQueryParams("SELECT * FROM products WHERE price > 9.99")).toBe(
      "SELECT * FROM products WHERE price > ?",
    );
  });

  it("returns null for empty string", () => {
    expect(normalizeQueryParams("")).toBeNull();
  });

  it("handles mixed parameter styles", () => {
    // $1 digit replaced first → $?, then string 'hello' → ?
    const result = normalizeQueryParams("INSERT INTO logs (id, msg) VALUES ($1, 'hello')");
    expect(result).toBe("INSERT INTO logs (id, msg) VALUES ($?, ?)");
  });
});
