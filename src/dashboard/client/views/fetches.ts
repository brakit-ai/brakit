import { DASHBOARD_API_FETCHES } from "../../../constants/index.js";

export function getFetchesView(): string {
  return `
  function buildFetchAnalysis() {
    var container = document.getElementById('fetch-analysis');
    if (!container) return;
    container.innerHTML = '';

    var fetches = state.fetches;
    if (fetches.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';

    var uniqueUrls = {};
    var errCount = 0;
    var totalDur = 0;
    for (var i = 0; i < fetches.length; i++) {
      uniqueUrls[fetches[i].url] = 1;
      if (fetches[i].statusCode >= 400) errCount++;
      totalDur += fetches[i].durationMs;
    }
    var uniqueCount = Object.keys(uniqueUrls).length;
    var avgDur = Math.round(totalDur / fetches.length);

    var summary = document.createElement('div');
    summary.className = 'fetch-summary';
    summary.innerHTML =
      '<div class="fetch-stat"><span class="fetch-stat-value">' + fetches.length + '</span><span class="fetch-stat-label">Total Fetches</span></div>' +
      '<div class="fetch-stat"><span class="fetch-stat-value">' + uniqueCount + '</span><span class="fetch-stat-label">Unique URLs</span></div>' +
      '<div class="fetch-stat"><span class="fetch-stat-value"' + (errCount > 0 ? ' style="color:var(--red)"' : '') + '>' + errCount + '</span><span class="fetch-stat-label">Errors</span></div>' +
      '<div class="fetch-stat"><span class="fetch-stat-value">' + formatDuration(avgDur) + '</span><span class="fetch-stat-label">Avg Duration</span></div>';
    container.appendChild(summary);

    var groups = {};
    for (var gi = 0; gi < fetches.length; gi++) {
      var f = fetches[gi];
      var key = f.method + ' ' + f.url;
      if (!groups[key]) groups[key] = { method: f.method, url: f.url, count: 0, totalDur: 0, maxDur: 0, errors: 0, callers: {} };
      var g = groups[key];
      g.count++;
      g.totalDur += f.durationMs;
      if (f.durationMs > g.maxDur) g.maxDur = f.durationMs;
      if (f.statusCode >= 400) g.errors++;
      if (f.parentRequestId) {
        for (var ri = 0; ri < state.requests.length; ri++) {
          if (state.requests[ri].id === f.parentRequestId) {
            var callerLabel = state.requests[ri].method + ' ' + (state.requests[ri].path || state.requests[ri].url);
            g.callers[callerLabel] = 1;
            break;
          }
        }
      }
    }

    var groupEntries = [];
    for (var gk in groups) groupEntries.push(groups[gk]);
    groupEntries.sort(function(a, b) { return b.count - a.count; });

    if (groupEntries.length > 0) {
      var title = document.createElement('div');
      title.className = 'fetch-groups-title';
      title.textContent = 'Grouped by URL (' + groupEntries.length + ')';
      container.appendChild(title);

      var groupsDiv = document.createElement('div');
      groupsDiv.className = 'fetch-groups';

      for (var gei = 0; gei < groupEntries.length; gei++) {
        var ge = groupEntries[gei];
        var card = document.createElement('div');
        card.className = 'fetch-group';

        var avgMs = Math.round(ge.totalDur / ge.count);
        var errRate = ge.count > 0 ? Math.round((ge.errors / ge.count) * 100) : 0;

        var headerHtml =
          '<div class="fetch-group-header">' +
            '<span class="method-badge method-badge-' + escHtml(ge.method) + '">' + escHtml(ge.method) + '</span>' +
            '<span class="fetch-group-url" title="' + escHtml(ge.url) + '">' + escHtml(ge.url) + '</span>' +
            '<span class="fetch-group-count">' + ge.count + 'x</span>' +
          '</div>';

        var metaHtml = '<div class="fetch-group-meta">' +
          '<span>Avg ' + formatDuration(avgMs) + '</span>' +
          '<span>Max ' + formatDuration(ge.maxDur) + '</span>' +
          (errRate > 0 ? '<span class="fetch-group-err">' + errRate + '% errors</span>' : '<span style="color:var(--green)">0% errors</span>') +
          '</div>';

        var callerKeys = Object.keys(ge.callers);
        var callerHtml = '';
        if (callerKeys.length > 0) {
          callerHtml = '<div class="fetch-group-callers">Called by: <strong>' + callerKeys.map(function(c) { return escHtml(c); }).join('</strong>, <strong>') + '</strong></div>';
        }

        card.innerHTML = headerHtml + metaHtml + callerHtml;
        groupsDiv.appendChild(card);
      }

      container.appendChild(groupsDiv);
    }
  }

  function renderFetches() {
    buildFetchAnalysis();
  }

  function prependFetchRow(f) {
    buildFetchAnalysis();
  }

  async function loadFetches() {
    try {
      var res = await fetch('${DASHBOARD_API_FETCHES}');
      var data = await res.json();
      state.fetches = data.entries;
      renderFetches();
    } catch(e) { console.warn('[brakit]', e); }
  }
  `;
}
