export function getGraphChart(): string {
  return `
  function drawDetailChart(canvas, sessions) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    var pad = { top: 16, right: 16, bottom: 28, left: 52 };
    var cw = w - pad.left - pad.right;
    var ch = h - pad.top - pad.bottom;
    if (sessions.length < 1) return;

    var maxVal = 0;
    sessions.forEach(function(s) {
      if (s.p95DurationMs > maxVal) maxVal = s.p95DurationMs;
      if (s.avgDurationMs > maxVal) maxVal = s.avgDurationMs;
    });
    maxVal = Math.max(maxVal, 10);
    maxVal = Math.ceil(maxVal * 1.1 / 10) * 10;

    ctx.strokeStyle = 'rgba(63,63,70,0.3)';
    ctx.lineWidth = 1;
    var gridLines = 4;
    for (var gi = 0; gi <= gridLines; gi++) {
      var gy = pad.top + ch - (gi / gridLines) * ch;
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + cw, gy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(161,161,170,0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(fmtMs(Math.round((gi / gridLines) * maxVal)), pad.left - 8, gy + 3);
    }

    var step = sessions.length > 1 ? cw / (sessions.length - 1) : 0;

    if (sessions.length > 1) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(168,85,247,0.06)';
      sessions.forEach(function(s, i) {
        var x = pad.left + i * step;
        var y = pad.top + ch - (s.p95DurationMs / maxVal) * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(pad.left + (sessions.length - 1) * step, pad.top + ch);
      ctx.lineTo(pad.left, pad.top + ch);
      ctx.closePath();
      ctx.fill();
    }

    if (sessions.length > 1) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(96,165,250,0.08)';
      sessions.forEach(function(s, i) {
        var x = pad.left + i * step;
        var y = pad.top + ch - (s.avgDurationMs / maxVal) * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(pad.left + (sessions.length - 1) * step, pad.top + ch);
      ctx.lineTo(pad.left, pad.top + ch);
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    sessions.forEach(function(s, i) {
      var x = sessions.length === 1 ? pad.left + cw / 2 : pad.left + i * step;
      var y = pad.top + ch - (s.p95DurationMs / maxVal) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    sessions.forEach(function(s, i) {
      var x = sessions.length === 1 ? pad.left + cw / 2 : pad.left + i * step;
      var y = pad.top + ch - (s.avgDurationMs / maxVal) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    sessions.forEach(function(s, i) {
      var x = sessions.length === 1 ? pad.left + cw / 2 : pad.left + i * step;
      var yAvg = pad.top + ch - (s.avgDurationMs / maxVal) * ch;
      var yP95 = pad.top + ch - (s.p95DurationMs / maxVal) * ch;

      ctx.beginPath(); ctx.arc(x, yP95, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#a855f7'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, yAvg, 3, 0, Math.PI * 2); ctx.fillStyle = '#60a5fa'; ctx.fill();

      if (sessions.length <= 12 || i === 0 || i === sessions.length - 1) {
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(fmtMs(s.avgDurationMs), x, yAvg - 8);
      }
    });

    ctx.fillStyle = 'rgba(161,161,170,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    var labelStep = Math.max(1, Math.floor(sessions.length / 6));
    sessions.forEach(function(s, i) {
      if (i % labelStep !== 0 && i !== sessions.length - 1) return;
      var x = sessions.length === 1 ? pad.left + cw / 2 : pad.left + i * step;
      var d = new Date(s.startedAt);
      ctx.fillText(d.toLocaleDateString([], {month:'short',day:'numeric'}), x, pad.top + ch + 14);
    });

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(w - 120, 6, 8, 8);
    ctx.fillStyle = 'rgba(161,161,170,0.7)'; ctx.fillText('avg', w - 108, 14);
    ctx.fillStyle = '#a855f7'; ctx.fillRect(w - 68, 6, 8, 8);
    ctx.fillStyle = 'rgba(161,161,170,0.7)'; ctx.fillText('p95', w - 56, 14);
  }
  `;
}
