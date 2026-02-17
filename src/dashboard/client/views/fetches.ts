import { DASHBOARD_API_FETCHES } from "../../../constants.js";

export function getFetchesView(): string {
  return `
  function buildFetchRow(f) {
    var row = document.createElement('div');
    row.className = 'req-row';
    var statusCls = f.statusCode >= 400 ? ' tel-status-err' : '';
    row.innerHTML =
      '<span class="tel-method">' + escHtml(f.method) + '</span>' +
      '<span class="tel-url" title="' + escHtml(f.url) + '">' + escHtml(f.url) + '</span>' +
      '<span class="tel-status' + statusCls + '">' + f.statusCode + '</span>' +
      '<span class="tel-duration">' + formatDuration(f.durationMs) + '</span>';
    return row;
  }

  var fetchView = createTelemetryView('fetch-list', buildFetchRow);
  function renderFetches() { fetchView.render(state.fetches); }
  function prependFetchRow(f) { fetchView.prepend(f); }

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
