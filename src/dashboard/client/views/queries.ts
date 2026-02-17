import {
  DASHBOARD_API_QUERIES,
} from "../../../constants.js";

export function getQueriesView(): string {
  return `
  var QUERY_OP_COLORS = {
    SELECT: 'var(--blue)',
    INSERT: '#22c55e',
    UPDATE: '#f59e0b',
    DELETE: 'var(--red)',
    COUNT: 'var(--dim)'
  };

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
    // Strip excessive quoting for readability
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
    row.className = 'req-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '16px';
    row.style.fontFamily = 'var(--mono)';
    row.style.fontSize = '13px';

    var info = q.sql ? simplifySQL(q.sql) : { op: q.operation || '?', table: q.model || '' };
    var opColor = QUERY_OP_COLORS[info.op] || 'var(--fg)';
    var slowStyle = q.durationMs > 100 ? 'color:var(--red);font-weight:500' : '';
    var preview = q.sql ? truncateSQL(q.sql, 60) : info.op + ' ' + info.table;

    row.innerHTML =
      '<span style="width:70px;flex-shrink:0;font-weight:600;color:' + opColor + ';border-right:1px solid var(--border-subtle);padding-right:16px">' + escHtml(info.op) + '</span>' +
      '<span style="width:120px;flex-shrink:0;font-weight:500;color:var(--fg);border-right:1px solid var(--border-subtle);padding-right:16px">' + escHtml(info.table) + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim);font-size:11px;border-right:1px solid var(--border-subtle);padding-right:16px">' + escHtml(preview) + '</span>' +
      '<span style="width:60px;flex-shrink:0;text-align:right;' + slowStyle + '">' + queryDuration(q.durationMs) + '</span>';

    row.addEventListener('click', function() {
      var text = q.sql || (info.op + ' ' + info.table);
      navigator.clipboard.writeText(text).then(function() { showToast('SQL copied'); });
    });

    return row;
  }

  function renderQueries() {
    var list = document.getElementById('query-list');
    if (!list) return;
    list.innerHTML = '';
    state.queries.forEach(function(q) { appendQueryRow(q); });
  }

  function appendQueryRow(q) {
    var list = document.getElementById('query-list');
    if (!list) return;
    list.appendChild(buildQueryRow(q));
  }

  function prependQueryRow(q) {
    var list = document.getElementById('query-list');
    if (!list) return;
    list.insertBefore(buildQueryRow(q), list.firstChild);
  }

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
