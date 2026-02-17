export function getGraphOverview(): string {
  return `
  function renderPerfOverview(container) {
    var totalReqs = 0, totalErrors = 0, weightedDuration = 0, totalCount = 0;
    var slowest = null, slowestMs = 0;
    var fastest = null, fastestMs = Infinity;
    var mostErrors = null, mostErrorCount = 0;

    graphData.forEach(function(ep) {
      var latest = ep.sessions[ep.sessions.length - 1];
      if (!latest) return;
      totalReqs += latest.requestCount;
      totalErrors += latest.errorCount;
      weightedDuration += latest.avgDurationMs * latest.requestCount;
      totalCount += latest.requestCount;
      if (latest.avgDurationMs > slowestMs) { slowestMs = latest.avgDurationMs; slowest = ep.endpoint; }
      if (latest.avgDurationMs < fastestMs) { fastestMs = latest.avgDurationMs; fastest = ep.endpoint; }
      var epErrors = ep.sessions.reduce(function(s, x) { return s + x.errorCount; }, 0);
      if (epErrors > mostErrorCount) { mostErrorCount = epErrors; mostErrors = ep.endpoint; }
    });
    var overallAvg = totalCount > 0 ? Math.round(weightedDuration / totalCount) : 0;
    var grade = healthGrade(overallAvg);

    var insights = document.createElement('div');
    insights.className = 'perf-insights';

    var healthBadge = '<div class="perf-health-card" style="border-color:' + grade.border + ';background:' + grade.bg + '">' +
      '<span class="perf-health-label" style="color:' + grade.color + '">' + grade.label + '</span>' +
      '<span class="perf-health-value">' + fmtMs(overallAvg) + ' avg</span>' +
      '</div>';

    var observations = [];
    if (slowest) {
      var sg = healthGrade(slowestMs);
      observations.push('<span class="perf-obs"><span class="perf-obs-icon" style="color:' + sg.color + '">\\u25CF</span>Slowest: <strong>' + escHtml(slowest) + '</strong> at ' + fmtMs(slowestMs) + '</span>');
    }
    if (fastest && fastest !== slowest) {
      observations.push('<span class="perf-obs"><span class="perf-obs-icon" style="color:var(--green)">\\u25CF</span>Fastest: <strong>' + escHtml(fastest) + '</strong> at ' + fmtMs(fastestMs) + '</span>');
    }
    if (mostErrors && mostErrorCount > 0) {
      observations.push('<span class="perf-obs"><span class="perf-obs-icon" style="color:var(--red)">\\u25CF</span><strong>' + escHtml(mostErrors) + '</strong> has ' + mostErrorCount + ' error' + (mostErrorCount !== 1 ? 's' : '') + '</span>');
    }
    if (totalErrors === 0) {
      observations.push('<span class="perf-obs"><span class="perf-obs-icon" style="color:var(--green)">\\u2713</span>No errors recorded</span>');
    }

    insights.innerHTML = healthBadge +
      '<div class="perf-obs-list">' + observations.join('') + '</div>';
    container.appendChild(insights);

    var cardsWrap = document.createElement('div');
    cardsWrap.className = 'perf-cards';

    var sorted = graphData.slice().sort(function(a, b) {
      var aLatest = a.sessions.length > 0 ? a.sessions[a.sessions.length - 1].avgDurationMs : 0;
      var bLatest = b.sessions.length > 0 ? b.sessions[b.sessions.length - 1].avgDurationMs : 0;
      return bLatest - aLatest;
    });

    var globalMax = 0;
    sorted.forEach(function(ep) {
      var latest = ep.sessions[ep.sessions.length - 1];
      if (latest && latest.p95DurationMs > globalMax) globalMax = latest.p95DurationMs;
      if (latest && latest.avgDurationMs > globalMax) globalMax = latest.avgDurationMs;
    });
    if (globalMax < 10) globalMax = 10;

    sorted.forEach(function(ep, sortIdx) {
      var origIdx = graphData.indexOf(ep);
      var color = GRAPH_COLORS[origIdx % GRAPH_COLORS.length];
      var sessions = ep.sessions;
      if (sessions.length === 0) return;
      var latest = sessions[sessions.length - 1];
      var first = sessions[0];
      var g = healthGrade(latest.avgDurationMs);
      var ti = sessions.length >= 2 ? trendInfo(first.avgDurationMs, latest.avgDurationMs) : null;

      var card = document.createElement('div');
      card.className = 'perf-card';
      card.addEventListener('click', function() { selectedEndpoint = ep.endpoint; renderGraph(); });

      var row1 = '<div class="perf-card-header">' +
        '<span class="perf-dot" style="background:' + color + '"></span>' +
        '<span class="perf-card-name">' + escHtml(ep.endpoint) + '</span>' +
        '<span class="perf-badge" style="color:' + g.color + ';background:' + g.bg + ';border-color:' + g.border + '">' + g.label + '</span>' +
        '</div>';

      var avgPct = Math.max(2, (latest.avgDurationMs / globalMax) * 100);
      var p95Pct = Math.max(2, (latest.p95DurationMs / globalMax) * 100);
      var row2 = '<div class="perf-card-bars">' +
        '<div class="perf-bar-row"><span class="perf-bar-label">avg</span><div class="perf-bar-track"><div class="perf-bar-fill" style="width:' + avgPct + '%;background:' + color + '"></div></div><span class="perf-bar-value">' + fmtMs(latest.avgDurationMs) + '</span></div>' +
        '<div class="perf-bar-row"><span class="perf-bar-label">p95</span><div class="perf-bar-track"><div class="perf-bar-fill" style="width:' + p95Pct + '%;background:' + color + ';opacity:0.5"></div></div><span class="perf-bar-value">' + fmtMs(latest.p95DurationMs) + '</span></div>' +
        '</div>';

      var sparkId = 'spark-' + sortIdx;
      var trendHtml = '';
      if (ti) {
        trendHtml = '<span class="perf-trend" style="color:' + ti.color + '">' + ti.arrow + ' ' + (ti.label === 'Stable' ? 'Stable' : ti.pct + '% ' + ti.label.toLowerCase()) + '</span>';
      } else {
        trendHtml = '<span class="perf-trend" style="color:var(--text-muted)">1 session</span>';
      }

      var row3 = '<div class="perf-card-footer">' +
        '<canvas id="' + sparkId + '" width="80" height="24" class="perf-spark"></canvas>' +
        trendHtml +
        '<span class="perf-card-stat">' + latest.requestCount + ' req' + (latest.requestCount !== 1 ? 's' : '') + '</span>' +
        (latest.errorCount > 0 ? '<span class="perf-card-stat" style="color:var(--red)">' + latest.errorCount + ' err</span>' : '') +
        (latest.avgQueryCount > 0 ? '<span class="perf-card-stat">' + latest.avgQueryCount + ' q/req</span>' : '') +
        '</div>';

      card.innerHTML = row1 + row2 + row3;
      cardsWrap.appendChild(card);

      setTimeout(function() {
        var sc = document.getElementById(sparkId);
        if (sc) drawSparkline(sc, sessions, color);
      }, 0);
    });

    container.appendChild(cardsWrap);
  }

  function drawSparkline(canvas, sessions, color) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    var vals = sessions.map(function(s) { return s.avgDurationMs; });
    if (vals.length < 2) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      return;
    }

    var maxV = Math.max.apply(null, vals);
    var minV = Math.min.apply(null, vals);
    var range = maxV - minV || 1;
    var pad = 3;
    var cw = w - pad * 2;
    var ch = h - pad * 2;
    var step = cw / (vals.length - 1);

    ctx.beginPath();
    vals.forEach(function(v, i) {
      var x = pad + i * step;
      var y = pad + ch - ((v - minV) / range) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad + (vals.length - 1) * step, pad + ch);
    ctx.lineTo(pad, pad + ch);
    ctx.closePath();
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    vals.forEach(function(v, i) {
      var x = pad + i * step;
      var y = pad + ch - ((v - minV) / range) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    var lastX = pad + (vals.length - 1) * step;
    var lastY = pad + ch - ((vals[vals.length - 1] - minV) / range) * ch;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  `;
}
