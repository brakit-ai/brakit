import {
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  DOT_COLORS,
  HEALTH_GRADES,
} from "../../constants.js";

export function getGraphHealthUtils(): string {
  return `
  var HEALTH_GRADES = ${HEALTH_GRADES};
  var DOT_COLORS = ${DOT_COLORS};

  function healthGrade(ms) {
    for (var i = 0; i < HEALTH_GRADES.length; i++) {
      if (ms < HEALTH_GRADES[i].max) return HEALTH_GRADES[i];
    }
    return HEALTH_GRADES[HEALTH_GRADES.length - 1];
  }

  function fmtMs(ms) {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function dotColor(ms) {
    if (ms < ${HEALTH_GOOD_MS}) return DOT_COLORS.green;
    if (ms < ${HEALTH_OK_MS}) return DOT_COLORS.amber;
    return DOT_COLORS.red;
  }

  function buildMetricCard(label, value, color) {
    return '<div class="perf-metric-card">' +
      '<span class="perf-metric-label">' + label + '</span>' +
      '<span class="perf-metric-value" style="color:' + color + '">' + value + '</span>' +
      '</div>';
  }
  `;
}
