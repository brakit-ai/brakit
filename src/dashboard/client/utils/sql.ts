import { escHtml } from "./format.js";

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "INSERT", "INTO", "VALUES",
  "UPDATE", "SET", "DELETE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "AS",
  "IN", "NOT", "NULL", "IS", "LIKE", "BETWEEN", "EXISTS", "CASE",
  "WHEN", "THEN", "ELSE", "END", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "DISTINCT", "UNION", "ALL", "CREATE", "TABLE", "ALTER", "DROP",
  "INDEX", "RETURNING", "WITH", "RECURSIVE", "OVER", "PARTITION",
  "WINDOW", "FETCH", "NEXT", "ROWS", "ONLY", "CAST", "COALESCE",
  "NULLIF", "EXTRACT", "INTERVAL", "TRUE", "FALSE", "ASC", "DESC",
  "USING", "NATURAL", "CROSS", "FULL", "ROLLBACK", "COMMIT", "BEGIN",
  "TRANSACTION", "SAVEPOINT", "RELEASE",
]);

export function extractOp(sql: string): string {
  const m = sql.trim().match(/^(\w+)/);
  return m ? m[1].toUpperCase() : "?";
}

export function extractTable(sql: string): string {
  const s = sql.replace(/\s+/g, " ").trim();
  const fromMatch = s.match(/\bFROM\s+["'`]?(\w+)["'`]?/i);
  if (fromMatch) return fromMatch[1];
  const intoMatch = s.match(/\bINTO\s+["'`]?(\w+)["'`]?/i);
  if (intoMatch) return intoMatch[1];
  const updateMatch = s.match(/\bUPDATE\s+["'`]?(\w+)["'`]?/i);
  if (updateMatch) return updateMatch[1];
  return "";
}

/** Returns HTML with SQL keywords wrapped in `<span class="sql-kw">`. Input is escaped first to prevent XSS. */
export function highlightSql(sql: string): string {
  return escHtml(sql).replace(/\b\w+\b/g, (word) => {
    if (SQL_KEYWORDS.has(word.toUpperCase())) {
      return '<span class="sql-kw">' + word + "</span>";
    }
    return word;
  });
}
