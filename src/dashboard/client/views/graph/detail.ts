import { HIGH_QUERY_COUNT_PER_REQ } from "../../constants.js";

export function getGraphDetail(): string {
  return `
  function renderEndpointDetail(container) {
    var ep = graphData.find(function(e) { return e.endpoint === selectedEndpoint; });
    if (!ep || !ep.sessions || ep.sessions.length === 0) {
      container.innerHTML += '<div class="empty" style="height:300px"><span class="empty-sub">No data for this endpoint</span></div>';
      return;
    }

    var sessions = ep.sessions;
    var latest = sessions[sessions.length - 1];
    var first = sessions[0];
    var g = healthGrade(latest.avgDurationMs);
    var ti = sessions.length >= 2 ? trendInfo(first.avgDurationMs, latest.avgDurationMs) : null;
    var totalReqs = sessions.reduce(function(s, x) { return s + x.requestCount; }, 0);
    var totalErrors = sessions.reduce(function(s, x) { return s + x.errorCount; }, 0);

    var header = document.createElement('div');
    header.className = 'perf-detail-header';

    var badgeHtml = '<span class="perf-badge perf-badge-lg" style="color:' + g.color + ';background:' + g.bg + ';border-color:' + g.border + '">' + g.label + '</span>';
    var trendHtml = '';
    if (ti) {
      trendHtml = '<span class="perf-trend perf-trend-lg" style="color:' + ti.color + '">' + ti.arrow + ' ' + (ti.label === 'Stable' ? 'Stable' : ti.pct + '% ' + ti.label.toLowerCase()) + ' vs first session</span>';
    }

    header.innerHTML =
      '<div class="perf-detail-title">' + badgeHtml + '<span>' + escHtml(ep.endpoint) + '</span></div>' +
      (trendHtml ? '<div style="padding:0 0 0 2px">' + trendHtml + '</div>' : '');
    container.appendChild(header);

    var metrics = document.createElement('div');
    metrics.className = 'perf-metric-row';
    metrics.innerHTML =
      buildMetricCard('Average', fmtMs(latest.avgDurationMs), g.color) +
      buildMetricCard('P95', fmtMs(latest.p95DurationMs), healthGrade(latest.p95DurationMs).color) +
      buildMetricCard('Requests', String(totalReqs), 'var(--text)') +
      buildMetricCard('Queries/req', String(latest.avgQueryCount), latest.avgQueryCount > ${HIGH_QUERY_COUNT_PER_REQ} ? 'var(--amber)' : 'var(--text)') +
      buildMetricCard('Errors', String(totalErrors), totalErrors > 0 ? 'var(--red)' : 'var(--green)');
    container.appendChild(metrics);

    var chartWrap = document.createElement('div');
    chartWrap.className = 'perf-chart-wrap';
    var chartLabel = document.createElement('div');
    chartLabel.className = 'perf-section-title';
    chartLabel.textContent = 'Response Time Across Sessions';
    chartWrap.appendChild(chartLabel);

    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240;
    canvas.style.cssText = 'width:100%;height:240px';
    canvas.className = 'perf-canvas';
    chartWrap.appendChild(canvas);
    container.appendChild(chartWrap);

    drawDetailChart(canvas, sessions);

    if (sessions.length > 0) {
      var histWrap = document.createElement('div');
      histWrap.className = 'perf-history-wrap';

      var colHeader = document.createElement('div');
      colHeader.className = 'col-header';
      colHeader.innerHTML =
        '<span class="perf-col perf-col-date">Date</span>' +
        '<span class="perf-col perf-col-health">Health</span>' +
        '<span class="perf-col perf-col-avg">Avg</span>' +
        '<span class="perf-col perf-col-p95">P95</span>' +
        '<span class="perf-col perf-col-trend">Trend</span>' +
        '<span class="perf-col perf-col-reqs">Requests</span>' +
        '<span class="perf-col perf-col-err">Errors</span>' +
        '<span class="perf-col perf-col-qpr">Queries/req</span>';
      histWrap.appendChild(colHeader);

      sessions.slice().reverse().forEach(function(s, revIdx) {
        var idx = sessions.length - 1 - revIdx;
        var sg = healthGrade(s.avgDurationMs);
        var date = new Date(s.startedAt);
        var dateStr = date.toLocaleDateString([], {month:'short',day:'numeric'}) + ' ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

        var trendCell = '<span style="color:var(--text-muted)">&mdash;</span>';
        if (idx > 0) {
          var prev = sessions[idx - 1];
          var chg = trendInfo(prev.avgDurationMs, s.avgDurationMs);
          if (chg.label === 'Stable') {
            trendCell = '<span style="color:' + chg.color + '">' + chg.arrow + ' Stable</span>';
          } else {
            trendCell = '<span style="color:' + chg.color + '">' + chg.arrow + ' ' + chg.pct + '%</span>';
          }
        }

        var row = document.createElement('div');
        row.className = 'perf-hist-row';
        row.innerHTML =
          '<span class="perf-col perf-col-date">' + dateStr + '</span>' +
          '<span class="perf-col perf-col-health"><span class="perf-badge perf-badge-sm" style="color:' + sg.color + ';background:' + sg.bg + ';border-color:' + sg.border + '">' + sg.label + '</span></span>' +
          '<span class="perf-col perf-col-avg">' + fmtMs(s.avgDurationMs) + '</span>' +
          '<span class="perf-col perf-col-p95">' + fmtMs(s.p95DurationMs) + '</span>' +
          '<span class="perf-col perf-col-trend">' + trendCell + '</span>' +
          '<span class="perf-col perf-col-reqs">' + s.requestCount + '</span>' +
          '<span class="perf-col perf-col-err" style="color:' + (s.errorCount > 0 ? 'var(--red)' : 'var(--text-muted)') + '">' + s.errorCount + '</span>' +
          '<span class="perf-col perf-col-qpr">' + s.avgQueryCount + '</span>';
        histWrap.appendChild(row);
      });
      container.appendChild(histWrap);
    }
  }
  `;
}
