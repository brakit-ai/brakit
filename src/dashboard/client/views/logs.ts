import { DASHBOARD_API_LOGS } from "../../../constants/index.js";

export function getLogsView(): string {
  return `
  function buildLogRow(l) {
    var row = document.createElement('div');
    row.className = 'req-row';
    var ts = new Date(l.timestamp).toLocaleTimeString();
    row.innerHTML =
      '<span class="tel-level tel-level-' + l.level + '">' + l.level.toUpperCase() + '</span>' +
      '<span class="tel-message tel-mono" title="' + escHtml(l.message) + '">' + escHtml(l.message) + '</span>' +
      '<span class="tel-timestamp">' + ts + '</span>';
    return row;
  }

  function buildLogAnalysis() {
    var container = document.getElementById('log-analysis');
    if (!container) return;
    container.innerHTML = '';

    var logs = state.logs;
    if (logs.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';

    var counts = { error: 0, warn: 0, info: 0, debug: 0, log: 0 };
    for (var i = 0; i < logs.length; i++) {
      var lvl = logs[i].level;
      if (counts[lvl] !== undefined) counts[lvl]++;
    }

    var summary = document.createElement('div');
    summary.className = 'fetch-summary';
    summary.innerHTML =
      '<div class="fetch-stat"><span class="fetch-stat-value">' + logs.length + '</span><span class="fetch-stat-label">Total Logs</span></div>' +
      (counts.error > 0 ? '<div class="fetch-stat"><span class="fetch-stat-value" style="color:var(--red)">' + counts.error + '</span><span class="fetch-stat-label">Errors</span></div>' : '') +
      (counts.warn > 0 ? '<div class="fetch-stat"><span class="fetch-stat-value" style="color:var(--amber)">' + counts.warn + '</span><span class="fetch-stat-label">Warnings</span></div>' : '') +
      '<div class="fetch-stat"><span class="fetch-stat-value">' + counts.info + '</span><span class="fetch-stat-label">Info</span></div>' +
      (counts.debug > 0 ? '<div class="fetch-stat"><span class="fetch-stat-value">' + counts.debug + '</span><span class="fetch-stat-label">Debug</span></div>' : '') +
      (counts.log > 0 ? '<div class="fetch-stat"><span class="fetch-stat-value">' + counts.log + '</span><span class="fetch-stat-label">Log</span></div>' : '');
    container.appendChild(summary);
  }

  var logView = createTelemetryView('log-list', buildLogRow);

  function renderLogs() {
    buildLogAnalysis();
    logView.render(state.logs);
  }

  function prependLogRow(l) {
    buildLogAnalysis();
    logView.prepend(l);
  }

  async function loadLogs() {
    try {
      var res = await fetch('${DASHBOARD_API_LOGS}');
      var data = await res.json();
      state.logs = data.entries;
      renderLogs();
    } catch(e) { console.warn('[brakit]', e); }
  }
  `;
}
