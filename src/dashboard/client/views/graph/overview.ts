import { HIGH_QUERY_COUNT_PER_REQ } from "../../constants.js";

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

      var chartId = 'inline-scatter-' + idx;

      card.innerHTML =
        '<div class="perf-ep-header">' +
          '<span class="perf-ep-name">' + escHtml(ep.endpoint) + '</span>' +
          '<span class="perf-ep-stats">' + statsHtml + '</span>' +
        '</div>' +
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
