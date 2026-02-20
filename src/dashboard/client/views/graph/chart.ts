import {
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  CHART_GRID_COLOR,
  CHART_LABEL_COLOR,
  CHART_FONT,
  CHART_FONT_SM,
  CHART_FONT_XS,
  CHART_PAD,
} from "../../constants/index.js";

export function getGraphChart(): string {
  return `
  var THRESHOLD_GOOD = ${HEALTH_GOOD_MS};
  var THRESHOLD_OK = ${HEALTH_OK_MS};
  var CHART_PAD = ${CHART_PAD};

  var scatterDots = [];

  function setupCanvas(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: w, h: h };
  }

  function reqDotColor(r) {
    if (r.statusCode >= 400) return DOT_COLORS.red;
    return dotColor(r.durationMs);
  }

  function drawDot(ctx, x, y, radius, color) {
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    ctx.beginPath();
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawErrorX(ctx, x, y, size, color, lineWidth) {
    var r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.3)';
    ctx.lineWidth = lineWidth + 2;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size);
    ctx.stroke();
  }

  // Maps time → x-axis, duration → y-axis as a scatter plot
  function drawScatterChart(canvas, requests) {
    scatterDots = [];
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx, w = setup.w, h = setup.h;
    if (requests.length === 0) return;

    var pad = CHART_PAD;
    var cw = w - pad.left - pad.right;
    var ch = h - pad.top - pad.bottom;

    var maxVal = 0;
    var minTime = requests[0].timestamp, maxTime = requests[0].timestamp;
    requests.forEach(function(r) {
      if (r.durationMs > maxVal) maxVal = r.durationMs;
      if (r.timestamp < minTime) minTime = r.timestamp;
      if (r.timestamp > maxTime) maxTime = r.timestamp;
    });
    maxVal = Math.max(maxVal, 10);
    maxVal = Math.ceil(maxVal * 1.15 / 10) * 10;
    var timeRange = maxTime - minTime || 1;

    ctx.strokeStyle = ${CHART_GRID_COLOR};
    ctx.lineWidth = 1;
    var gridLines = 4;
    for (var gi = 0; gi <= gridLines; gi++) {
      var gy = pad.top + ch - (gi / gridLines) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + cw, gy);
      ctx.stroke();
      ctx.fillStyle = ${CHART_LABEL_COLOR};
      ctx.font = ${CHART_FONT};
      ctx.textAlign = 'right';
      ctx.fillText(fmtMs(Math.round((gi / gridLines) * maxVal)), pad.left - 8, gy + 3);
    }

    var thresholds = [
      { ms: THRESHOLD_GOOD, label: fmtMs(THRESHOLD_GOOD) },
      { ms: THRESHOLD_OK, label: fmtMs(THRESHOLD_OK) }
    ];
    thresholds.forEach(function(t) {
      if (t.ms >= maxVal) return;
      var ty = pad.top + ch - (t.ms / maxVal) * ch;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(113,113,122,0.3)';
      ctx.lineWidth = 1;
      ctx.moveTo(pad.left, ty);
      ctx.lineTo(pad.left + cw, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(113,113,122,0.5)';
      ctx.font = ${CHART_FONT_SM};
      ctx.textAlign = 'left';
      ctx.fillText(t.label, pad.left + cw + 2, ty + 3);
    });

    requests.forEach(function(r, idx) {
      var x = requests.length === 1 ? pad.left + cw / 2 : pad.left + ((r.timestamp - minTime) / timeRange) * cw;
      var y = pad.top + ch - (r.durationMs / maxVal) * ch;
      var color = reqDotColor(r);

      scatterDots.push({ x: x, y: y, idx: idx, r: r });

      if (r.statusCode >= 400) {
        drawErrorX(ctx, x, y, 4, color, 2);
      } else {
        drawDot(ctx, x, y, 4, color);
      }
    });

    ctx.fillStyle = ${CHART_LABEL_COLOR};
    ctx.font = ${CHART_FONT_SM};
    ctx.textAlign = 'center';
    var timePoints = [minTime, minTime + timeRange / 2, maxTime];
    timePoints.forEach(function(t, i) {
      var x = pad.left + (i / 2) * cw;
      var d = new Date(t);
      ctx.fillText(d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}), x, pad.top + ch + 14);
    });

    canvas.style.cursor = 'pointer';
    canvas.onclick = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var closest = null, closestDist = Infinity;
      scatterDots.forEach(function(d) {
        var dist = Math.sqrt((d.x - mx) * (d.x - mx) + (d.y - my) * (d.y - my));
        if (dist < closestDist) { closestDist = dist; closest = d; }
      });
      if (closest && closestDist < 16) {
        highlightRow(closest.idx);
      }
    };
  }

  function highlightRow(reqIdx) {
    var prev = document.querySelector('.perf-hist-row-hl');
    if (prev) prev.classList.remove('perf-hist-row-hl');
    var row = document.querySelector('[data-req-idx="' + reqIdx + '"]');
    if (row) {
      row.classList.add('perf-hist-row-hl');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function drawInlineScatter(canvas, requests) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx, w = setup.w, h = setup.h;
    if (requests.length === 0) return;

    var padX = 4, padY = 4;
    var cw = w - padX * 2;
    var ch = h - padY * 2;

    var maxVal = 0, minVal = Infinity;
    var minTime = requests[0].timestamp, maxTime = requests[0].timestamp;
    requests.forEach(function(r) {
      if (r.durationMs > maxVal) maxVal = r.durationMs;
      if (r.durationMs < minVal) minVal = r.durationMs;
      if (r.timestamp < minTime) minTime = r.timestamp;
      if (r.timestamp > maxTime) maxTime = r.timestamp;
    });
    maxVal = Math.max(maxVal, 10);
    maxVal = Math.ceil(maxVal * 1.15 / 10) * 10;
    var timeRange = maxTime - minTime || 1;

    [THRESHOLD_GOOD, THRESHOLD_OK].forEach(function(ms) {
      if (ms >= maxVal) return;
      var ty = padY + ch - (ms / maxVal) * ch;
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(113,113,122,0.15)';
      ctx.lineWidth = 1;
      ctx.moveTo(padX, ty);
      ctx.lineTo(padX + cw, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    requests.forEach(function(r) {
      var x = requests.length === 1 ? padX + cw / 2 : padX + ((r.timestamp - minTime) / timeRange) * cw;
      var y = padY + ch - (r.durationMs / maxVal) * ch;
      var color = reqDotColor(r);

      if (r.statusCode >= 400) {
        drawErrorX(ctx, x, y, 2.5, color, 1.5);
      } else {
        drawDot(ctx, x, y, 2.5, color);
      }
    });

    ctx.fillStyle = 'rgba(113,113,122,0.5)';
    ctx.font = ${CHART_FONT_XS};
    ctx.textAlign = 'right';
    ctx.fillText(fmtMs(maxVal), w - 2, padY + 8);
    ctx.fillText(fmtMs(0), w - 2, h - 2);
  }
  `;
}
