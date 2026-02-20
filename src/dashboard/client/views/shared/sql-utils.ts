/** Shared SQL utilities for client-side query display and analysis. */
import { QUERY_OP_COLORS } from "../../constants/index.js";

export function getSqlUtils(): string {
  return `
  var QUERY_OP_COLORS = ${QUERY_OP_COLORS};

  // Extracts operation and table name from raw SQL.
  // Handles Postgres schema-qualified names ("public"."table") and positional params ($1).
  function simplifySQL(sql) {
    if (!sql) return { op: '?', table: '' };
    var trimmed = sql.trim();
    var op = trimmed.split(/\\s+/)[0].toUpperCase();

    if (/SELECT\\s+COUNT/i.test(trimmed)) {
      var countTable = trimmed.match(/FROM\\s+"?\\w+"?\\."?(\\w+)"?/i);
      return { op: 'COUNT', table: countTable ? countTable[1] : '' };
    }

    var tableMatch = trimmed.match(/(?:FROM|INTO|UPDATE)\\s+"?\\w+"?\\."?(\\w+)"?/i);
    return { op: op, table: tableMatch ? tableMatch[1] : '' };
  }

  function truncateSQL(sql, max) {
    if (!sql) return '';
    var clean = sql.replace(/"public"\\./g, '').replace(/"/g, '');
    if (clean.length <= max) return clean;
    return clean.substring(0, max) + '...';
  }

  function queryDuration(ms) {
    if (ms === 0) return '<1ms';
    return formatDuration(ms);
  }

  // Normalizes SQL by replacing literal values with placeholders.
  // Used to group queries by "shape" for N+1 and cross-endpoint detection.
  function normalizeQueryParams(sql) {
    if (!sql) return null;
    var n = sql.replace(/'[^']*'/g, '?');
    n = n.replace(/\\b\\d+(\\.\\d+)?\\b/g, '?');
    n = n.replace(/\\$\\d+/g, '?');
    return n;
  }
  `;
}
