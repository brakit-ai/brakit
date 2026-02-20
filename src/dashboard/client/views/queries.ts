import { DASHBOARD_API_QUERIES } from "../../../constants/index.js";
import { SLOW_QUERY_THRESHOLD_MS } from "../constants/index.js";

export function getQueriesView(): string {
  return `
  function buildQueryRow(q) {
    var wrapper = document.createElement('div');
    var row = document.createElement('div');
    row.className = 'req-row query-row tel-clickable';

    var info = q.sql ? simplifySQL(q.sql) : { op: q.operation || '?', table: q.model || '' };
    var opColor = QUERY_OP_COLORS[info.op] || 'var(--text-dim)';
    var slowCls = q.durationMs > ${SLOW_QUERY_THRESHOLD_MS} ? ' query-slow' : '';
    var preview = q.sql || (info.op + ' ' + info.table);

    row.innerHTML =
      '<span class="query-op" title="' + escHtml(info.op) + '" style="color:' + opColor + '">' + escHtml(info.op) + '</span>' +
      '<span class="query-table" title="' + escHtml(info.table) + '">' + escHtml(info.table) + '</span>' +
      '<span class="query-preview" title="' + escHtml(preview) + '">' + escHtml(preview) + '</span>' +
      '<span class="query-dur' + slowCls + '">' + queryDuration(q.durationMs) + '</span>';

    var sqlText = q.sql || (info.op + ' ' + info.table);
    var detail = document.createElement('div');
    detail.className = 'query-detail';
    detail.innerHTML = '<pre class="query-detail-sql">' + escHtml(sqlText) + '</pre><button class="query-detail-copy">Copy</button>';

    row.addEventListener('click', function() {
      var wasOpen = detail.classList.contains('open');
      if (wasOpen) {
        detail.classList.remove('open');
        row.classList.remove('expanded');
      } else {
        detail.classList.add('open');
        row.classList.add('expanded');
      }
    });

    detail.querySelector('.query-detail-copy').addEventListener('click', function(e) {
      e.stopPropagation();
      navigator.clipboard.writeText(sqlText).then(function() { showToast('SQL copied'); });
    });

    wrapper.appendChild(row);
    wrapper.appendChild(detail);
    return wrapper;
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
    } catch(e) { console.warn('[brakit]', e); }
  }
  `;
}
