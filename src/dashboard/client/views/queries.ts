import { DASHBOARD_API_QUERIES } from "../../../constants/index.js";
import { QUERY_OP_COLORS, SLOW_QUERY_THRESHOLD_MS } from "../constants.js";

export function getQueriesView(): string {
  return `
  var QUERY_OP_COLORS = ${QUERY_OP_COLORS};

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

  function buildQueryRow(q) {
    var row = document.createElement('div');
    row.className = 'req-row query-row tel-clickable';

    var info = q.sql ? simplifySQL(q.sql) : { op: q.operation || '?', table: q.model || '' };
    var opColor = QUERY_OP_COLORS[info.op] || 'var(--text-dim)';
    var slowCls = q.durationMs > ${SLOW_QUERY_THRESHOLD_MS} ? ' query-slow' : '';
    var preview = q.sql ? truncateSQL(q.sql, 60) : info.op + ' ' + info.table;

    row.innerHTML =
      '<span class="query-op" style="color:' + opColor + '">' + escHtml(info.op) + '</span>' +
      '<span class="query-table">' + escHtml(info.table) + '</span>' +
      '<span class="query-preview">' + escHtml(preview) + '</span>' +
      '<span class="query-dur' + slowCls + '">' + queryDuration(q.durationMs) + '</span>';

    row.addEventListener('click', function() {
      var text = q.sql || (info.op + ' ' + info.table);
      navigator.clipboard.writeText(text).then(function() { showToast('SQL copied'); });
    });

    return row;
  }

  var queryView = createTelemetryView('query-list', buildQueryRow);
  function renderQueries() { queryView.render(state.queries); }
  function prependQueryRow(q) { queryView.prepend(q); }

  async function loadQueries() {
    try {
      var res = await fetch('${DASHBOARD_API_QUERIES}');
      var data = await res.json();
      state.queries = data.entries;
      renderQueries();
    } catch(e) {}
  }
  `;
}
