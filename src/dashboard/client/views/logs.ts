import {
  DASHBOARD_API_LOGS,
} from "../../../constants.js";

export function getLogsView(): string {
  return `
  var LOG_LEVEL_COLORS = { error: 'var(--red)', warn: '#f59e0b', info: 'var(--blue)', debug: 'var(--dim)', log: 'var(--fg)' };

  function renderLogs() {
    var list = document.getElementById('log-list');
    if (!list) return;
    list.innerHTML = '';
    state.logs.forEach(function(l) { appendLogRow(l); });
  }

  function appendLogRow(l) {
    var list = document.getElementById('log-list');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'req-row';
    var ts = new Date(l.timestamp).toLocaleTimeString();
    var color = LOG_LEVEL_COLORS[l.level] || 'var(--fg)';
    row.innerHTML =
      '<span style="width:60px;font-weight:500;color:' + color + '">' + l.level.toUpperCase() + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:12px" title="' + escHtml(l.message) + '">' + escHtml(l.message) + '</span>' +
      '<span style="width:130px;text-align:right;color:var(--dim)">' + ts + '</span>';
    list.appendChild(row);
  }

  function prependLogRow(l) {
    var list = document.getElementById('log-list');
    if (!list) return;
    appendLogRow(l);
    var last = list.lastChild;
    if (last) list.insertBefore(last, list.firstChild);
  }

  async function loadLogs() {
    try {
      var res = await fetch('${DASHBOARD_API_LOGS}');
      var data = await res.json();
      state.logs = data.entries;
      renderLogs();
    } catch(e) {}
  }
  `;
}
