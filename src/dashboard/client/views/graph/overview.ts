import { HIGH_QUERY_COUNT_PER_REQ } from "../../constants/index.js";

export function getGraphOverview(): string {
  return `
  var HIGH_QUERY_THRESHOLD = ${HIGH_QUERY_COUNT_PER_REQ};

  function renderPerfOverview(container) {
    var list = document.createElement('div');
    list.className = 'perf-endpoint-list';

    graphData.forEach(function(ep, idx) {
      if (ep.requests.length === 0) return;
      var s = ep.summary;
      var g = healthGrade(s.p95Ms);
      var errors = Math.round(s.errorRate * s.totalRequests);

      var card = document.createElement('div');
      card.className = 'perf-endpoint-card';
      card.addEventListener('click', function() { selectedEndpoint = ep.endpoint; renderGraph(); });

      var statsHtml =
        '<span class="perf-ep-stat" style="color:' + g.color + '">p95: ' + fmtMs(s.p95Ms) + '</span>' +
        '<span class="perf-ep-stat' + (errors > 0 ? ' perf-ep-stat-err' : '') + '">' + errors + ' err</span>' +
        (s.avgQueryCount > 0 ? '<span class="perf-ep-stat' + (s.avgQueryCount > HIGH_QUERY_THRESHOLD ? ' perf-ep-stat-warn' : '') + '">' + s.avgQueryCount + ' q/req</span>' : '') +
        '<span class="perf-ep-stat perf-ep-stat-muted">' + s.totalRequests + ' req' + (s.totalRequests !== 1 ? 's' : '') + '</span>';

      var ovTotal = (s.avgQueryTimeMs || 0) + (s.avgFetchTimeMs || 0) + (s.avgAppTimeMs || 0);
      var ovBarHtml = '';
      if (ovTotal > 0) {
        var ovDbPct = Math.round((s.avgQueryTimeMs || 0) / ovTotal * 100);
        var ovFetchPct = Math.round((s.avgFetchTimeMs || 0) / ovTotal * 100);
        var ovAppPct = Math.max(0, 100 - ovDbPct - ovFetchPct);
        ovBarHtml =
          '<div class="perf-breakdown-inline">' +
            '<div class="perf-breakdown-bar perf-breakdown-bar-sm">' +
              (ovDbPct > 0 ? '<div class="perf-breakdown-seg perf-breakdown-db" style="width:' + ovDbPct + '%"></div>' : '') +
              (ovFetchPct > 0 ? '<div class="perf-breakdown-seg perf-breakdown-fetch" style="width:' + ovFetchPct + '%"></div>' : '') +
              (ovAppPct > 0 ? '<div class="perf-breakdown-seg perf-breakdown-app" style="width:' + ovAppPct + '%"></div>' : '') +
            '</div>' +
            '<span class="perf-breakdown-labels">' +
              (ovDbPct > 0 ? '<span class="perf-breakdown-lbl"><span class="perf-breakdown-dot perf-breakdown-db"></span>' + fmtMs(s.avgQueryTimeMs || 0) + '</span>' : '') +
              (ovFetchPct > 0 ? '<span class="perf-breakdown-lbl"><span class="perf-breakdown-dot perf-breakdown-fetch"></span>' + fmtMs(s.avgFetchTimeMs || 0) + '</span>' : '') +
              '<span class="perf-breakdown-lbl"><span class="perf-breakdown-dot perf-breakdown-app"></span>' + fmtMs(s.avgAppTimeMs || 0) + '</span>' +
            '</span>' +
          '</div>';
      }

      var chartId = 'inline-scatter-' + idx;

      card.innerHTML =
        '<div class="perf-ep-header">' +
          '<span class="perf-ep-name">' + escHtml(ep.endpoint) + '</span>' +
          '<span class="perf-ep-stats">' + statsHtml + '</span>' +
        '</div>' +
        ovBarHtml +
        '<canvas id="' + chartId + '" class="perf-inline-canvas"></canvas>';

      list.appendChild(card);

      setTimeout(function() {
        var c = document.getElementById(chartId);
        if (c) drawInlineScatter(c, ep.requests);
      }, 0);
    });

    container.appendChild(list);
  }
  `;
}
