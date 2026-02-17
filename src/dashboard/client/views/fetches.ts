import {
  DASHBOARD_API_FETCHES,
} from "../../../constants.js";

export function getFetchesView(): string {
  return `
  function renderFetches() {
    var list = document.getElementById('fetch-list');
    if (!list) return;
    list.innerHTML = '';
    state.fetches.forEach(function(f) { appendFetchRow(f); });
  }

  function appendFetchRow(f) {
    var list = document.getElementById('fetch-list');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'req-row';
    var statusCls = f.statusCode >= 400 ? ' style="color:var(--red)"' : '';
    row.innerHTML =
      '<span style="width:50px;font-weight:500">' + escHtml(f.method) + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(f.url) + '">' + escHtml(f.url) + '</span>' +
      '<span style="width:50px;text-align:right"' + statusCls + '>' + f.statusCode + '</span>' +
      '<span style="width:70px;text-align:right;color:var(--dim)">' + formatDuration(f.durationMs) + '</span>';
    list.appendChild(row);
  }

  function prependFetchRow(f) {
    var list = document.getElementById('fetch-list');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'req-row';
    var statusCls = f.statusCode >= 400 ? ' style="color:var(--red)"' : '';
    row.innerHTML =
      '<span style="width:50px;font-weight:500">' + escHtml(f.method) + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(f.url) + '">' + escHtml(f.url) + '</span>' +
      '<span style="width:50px;text-align:right"' + statusCls + '>' + f.statusCode + '</span>' +
      '<span style="width:70px;text-align:right;color:var(--dim)">' + formatDuration(f.durationMs) + '</span>';
    list.insertBefore(row, list.firstChild);
  }

  async function loadFetches() {
    try {
      var res = await fetch('${DASHBOARD_API_FETCHES}');
      var data = await res.json();
      state.fetches = data.entries;
      renderFetches();
    } catch(e) {}
  }
  `;
}
