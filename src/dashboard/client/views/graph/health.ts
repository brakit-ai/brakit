import {
  HEALTH_FAST_MS,
  HEALTH_GOOD_MS,
  HEALTH_OK_MS,
  HEALTH_SLOW_MS,
  TREND_STABLE_PCT,
  TREND_STABLE_ABS_MS,
} from "../../constants.js";

export function getGraphHealthUtils(): string {
  return `
  function healthGrade(ms) {
    if (ms < ${HEALTH_FAST_MS}) return { label: 'Fast', color: 'var(--green)', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)' };
    if (ms < ${HEALTH_GOOD_MS}) return { label: 'Good', color: 'var(--green)', bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.15)' };
    if (ms < ${HEALTH_OK_MS}) return { label: 'OK', color: 'var(--amber)', bg: 'rgba(217,119,6,0.06)', border: 'rgba(217,119,6,0.15)' };
    if (ms < ${HEALTH_SLOW_MS}) return { label: 'Slow', color: 'var(--red)', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.15)' };
    return { label: 'Critical', color: 'var(--red)', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' };
  }

  function fmtMs(ms) {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return Math.round(ms) + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }

  function trendInfo(firstAvg, latestAvg) {
    var diff = latestAvg - firstAvg;
    var absDiff = Math.abs(diff);
    var pct = firstAvg > 0 ? Math.round((diff / firstAvg) * 100) : 0;
    var absPct = Math.abs(pct);
    if (absPct < ${TREND_STABLE_PCT} && absDiff < ${TREND_STABLE_ABS_MS}) {
      return { label: 'Stable', arrow: '\\u2194', color: 'var(--text-muted)', pct: absPct };
    }
    if (diff <= 0) {
      return { label: 'Faster', arrow: '\\u2193', color: 'var(--green)', pct: absPct };
    }
    return { label: 'Slower', arrow: '\\u2191', color: 'var(--red)', pct: absPct };
  }

  function buildMetricCard(label, value, color) {
    return '<div class="perf-metric-card">' +
      '<span class="perf-metric-label">' + label + '</span>' +
      '<span class="perf-metric-value" style="color:' + color + '">' + value + '</span>' +
      '</div>';
  }
  `;
}
