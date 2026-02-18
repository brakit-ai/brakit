import { DASHBOARD_API_FETCHES } from "../../../constants/index.js";

export function getFetchesView(): string {
  return `
  function buildFetchRow(f) {
    var row = document.createElement('div');
    row.className = 'req-row';
    var sClass = f.statusCode >= 500 ? 'status-pill-5xx' : f.statusCode >= 400 ? 'status-pill-4xx' : f.statusCode >= 300 ? 'status-pill-3xx' : 'status-pill-2xx';
    row.innerHTML =
      '<span class="method-badge method-badge-' + escHtml(f.method) + '">' + escHtml(f.method) + '</span>' +
      '<span class="tel-url" title="' + escHtml(f.url) + '">' + escHtml(f.url) + '</span>' +
      '<span class="status-pill ' + sClass + '">' + f.statusCode + '</span>' +
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
