import { HIGH_QUERY_COUNT_PER_REQ } from "../../constants/index.js";

export function getGraphDetail(): string {
  return `
  function renderEndpointDetail(container) {
    var ep = graphData.find(function(e) { return e.endpoint === selectedEndpoint; });
    if (!ep || !ep.requests || ep.requests.length === 0) {
      container.innerHTML += '<div class="empty" style="height:300px"><span class="empty-sub">No data for this endpoint</span></div>';
      return;
    }

    var s = ep.summary;
    var g = healthGrade(s.p95Ms);
    var errors = Math.round(s.errorRate * s.totalRequests);

    var header = document.createElement('div');
    header.className = 'perf-detail-header';
    header.innerHTML =
      '<div class="perf-detail-title">' +
        '<span class="perf-badge perf-badge-lg" style="color:' + g.color + ';background:' + g.bg + ';border-color:' + g.border + '">' + g.label + '</span>' +
        '<span>' + escHtml(ep.endpoint) + '</span>' +
      '</div>';
    container.appendChild(header);

    var metrics = document.createElement('div');
    metrics.className = 'perf-metric-row';
    metrics.innerHTML =
      buildMetricCard('P95', fmtMs(s.p95Ms), g.color) +
      buildMetricCard('Errors', errors > 0 ? errors + ' (' + Math.round(s.errorRate * 100) + '%)' : '0', errors > 0 ? 'var(--red)' : 'var(--green)') +
      buildMetricCard('Queries/req', String(s.avgQueryCount), s.avgQueryCount > ${HIGH_QUERY_COUNT_PER_REQ} ? 'var(--amber)' : 'var(--text)');
    container.appendChild(metrics);

    var totalAvg = (s.avgQueryTimeMs || 0) + (s.avgFetchTimeMs || 0) + (s.avgAppTimeMs || 0);
    if (totalAvg > 0) {
      var dbPct = Math.round((s.avgQueryTimeMs || 0) / totalAvg * 100);
      var fetchPct = Math.round((s.avgFetchTimeMs || 0) / totalAvg * 100);
      var appPct = Math.max(0, 100 - dbPct - fetchPct);

      var breakdown = document.createElement('div');
      breakdown.className = 'perf-breakdown';

      var breakdownLabel = document.createElement('div');
      breakdownLabel.className = 'perf-section-title';
      breakdownLabel.textContent = 'Time Breakdown';
      breakdown.appendChild(breakdownLabel);

      var bar = document.createElement('div');
      bar.className = 'perf-breakdown-bar';
      if (dbPct > 0) bar.innerHTML += '<div class="perf-breakdown-seg perf-breakdown-db" style="width:' + dbPct + '%"></div>';
      if (fetchPct > 0) bar.innerHTML += '<div class="perf-breakdown-seg perf-breakdown-fetch" style="width:' + fetchPct + '%"></div>';
      if (appPct > 0) bar.innerHTML += '<div class="perf-breakdown-seg perf-breakdown-app" style="width:' + appPct + '%"></div>';
      breakdown.appendChild(bar);

      var legend = document.createElement('div');
      legend.className = 'perf-breakdown-legend';
      legend.innerHTML =
        '<span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-db"></span>DB ' + fmtMs(s.avgQueryTimeMs || 0) + ' (' + dbPct + '%)</span>' +
        '<span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-fetch"></span>Fetch ' + fmtMs(s.avgFetchTimeMs || 0) + ' (' + fetchPct + '%)</span>' +
        '<span class="perf-breakdown-item"><span class="perf-breakdown-dot perf-breakdown-app"></span>App ' + fmtMs(s.avgAppTimeMs || 0) + ' (' + appPct + '%)</span>';
      breakdown.appendChild(legend);

      container.appendChild(breakdown);
    }

    var chartWrap = document.createElement('div');
    chartWrap.className = 'perf-chart-wrap';
    var chartLabel = document.createElement('div');
    chartLabel.className = 'perf-section-title';
    chartLabel.textContent = 'Response Time';
    chartWrap.appendChild(chartLabel);

    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 240;
    canvas.style.cssText = 'width:100%;height:240px';
    canvas.className = 'perf-canvas';
    chartWrap.appendChild(canvas);
    container.appendChild(chartWrap);

    drawScatterChart(canvas, ep.requests);

    if (ep.requests.length > 0) {
      var tableWrap = document.createElement('div');
      tableWrap.className = 'perf-history-wrap';

      var colHeader = document.createElement('div');
      colHeader.className = 'col-header';
      colHeader.innerHTML =
        '<span class="perf-col perf-col-date">Time</span>' +
        '<span class="perf-col perf-col-health">Health</span>' +
        '<span class="perf-col perf-col-avg">Duration</span>' +
        '<span class="perf-col perf-col-breakdown">Breakdown</span>' +
        '<span class="perf-col perf-col-status">Status</span>' +
        '<span class="perf-col perf-col-qpr">Queries</span>';
      tableWrap.appendChild(colHeader);

      var recentWithIdx = [];
      for (var ri = ep.requests.length - 1; ri >= 0 && recentWithIdx.length < 50; ri--) {
        recentWithIdx.push({ r: ep.requests[ri], origIdx: ri });
      }
      recentWithIdx.forEach(function(item) {
        var r = item.r;
        var rg = healthGrade(r.durationMs);
        var date = new Date(r.timestamp);
        var timeStr = date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
        var isError = r.statusCode >= 400;

        var row = document.createElement('div');
        row.className = 'perf-hist-row' + (isError ? ' perf-hist-row-err' : '');
        row.setAttribute('data-req-idx', item.origIdx);
        var rDbMs = r.queryTimeMs || 0;
        var rFetchMs = r.fetchTimeMs || 0;
        var rAppMs = Math.max(0, r.durationMs - rDbMs - rFetchMs);
        var breakdownParts = [];
        if (rDbMs > 0) breakdownParts.push('<span class="perf-bd-tag perf-bd-tag-db">DB ' + fmtMs(rDbMs) + '</span>');
        if (rFetchMs > 0) breakdownParts.push('<span class="perf-bd-tag perf-bd-tag-fetch">Fetch ' + fmtMs(rFetchMs) + '</span>');
        breakdownParts.push('<span class="perf-bd-tag perf-bd-tag-app">App ' + fmtMs(rAppMs) + '</span>');
        var breakdownHtml = breakdownParts.join('');

        row.innerHTML =
          '<span class="perf-col perf-col-date">' + timeStr + '</span>' +
          '<span class="perf-col perf-col-health"><span class="perf-badge perf-badge-sm" style="color:' + rg.color + ';background:' + rg.bg + ';border-color:' + rg.border + '">' + rg.label + '</span></span>' +
          '<span class="perf-col perf-col-avg">' + fmtMs(r.durationMs) + '</span>' +
          '<span class="perf-col perf-col-breakdown">' + breakdownHtml + '</span>' +
          '<span class="perf-col perf-col-status" style="color:' + (isError ? 'var(--red)' : 'var(--text-muted)') + '">' + r.statusCode + '</span>' +
          '<span class="perf-col perf-col-qpr">' + r.queryCount + '</span>';
        tableWrap.appendChild(row);
      });
      container.appendChild(tableWrap);
    }
  }
  `;
}
