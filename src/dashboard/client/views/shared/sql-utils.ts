import { QUERY_OP_COLORS } from "../../constants/index.js";

export function getSqlUtils(): string {
  return `
  var QUERY_OP_COLORS = ${QUERY_OP_COLORS};

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
  `;
}
