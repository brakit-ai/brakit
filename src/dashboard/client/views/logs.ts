import { DASHBOARD_API_LOGS } from "../../../constants.js";
import { LOG_LEVEL_COLORS } from "../constants.js";

export function getLogsView(): string {
  return `
  var LOG_LEVEL_COLORS = ${LOG_LEVEL_COLORS};

  function buildLogRow(l) {
    var row = document.createElement('div');
    row.className = 'req-row';
    var ts = new Date(l.timestamp).toLocaleTimeString();
    var color = LOG_LEVEL_COLORS[l.level] || 'var(--fg)';
    row.innerHTML =
      '<span class="tel-level" style="color:' + color + '">' + l.level.toUpperCase() + '</span>' +
      '<span class="tel-message tel-mono" title="' + escHtml(l.message) + '">' + escHtml(l.message) + '</span>' +
      '<span class="tel-timestamp">' + ts + '</span>';
    return row;
  }

  var logView = createTelemetryView('log-list', buildLogRow);
  function renderLogs() { logView.render(state.logs); }
  function prependLogRow(l) { logView.prepend(l); }

  async function loadLogs() {
    try {
      var res = await fetch('${DASHBOARD_API_LOGS}');
      var data = await res.json();
      state.logs = data.entries;
      renderLogs();
    } catch(e) {}
  }
  `;
}
