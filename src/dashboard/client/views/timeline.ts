import { DASHBOARD_API_ACTIVITY } from "../../../constants/index.js";

export function getTimelineView(): string {
  return `
  var TL_TYPE_COLORS = { fetch: 'var(--blue)', log: 'var(--text-muted)', error: 'var(--red)', query: 'var(--accent)' };
  var TL_TYPE_LABELS = { fetch: 'FETCH', log: 'LOG', error: 'ERROR', query: 'QUERY' };

  var timelineCache = {};
  var TIMELINE_CACHE_MAX = 50;

  async function loadTimeline(requestId, container, requestStartedAt) {
    if (timelineCache[requestId]) {
      renderTimelineContent(timelineCache[requestId], container, requestStartedAt);
      return;
    }

    container.innerHTML = '<div class="tl-loading">Loading activity...</div>';

    try {
      var res = await fetch('${DASHBOARD_API_ACTIVITY}?requestId=' + requestId);
      var data = await res.json();

      var keys = Object.keys(timelineCache);
      if (keys.length >= TIMELINE_CACHE_MAX) delete timelineCache[keys[0]];
      timelineCache[requestId] = data;

      renderTimelineContent(data, container, requestStartedAt);
    } catch(ex) {
      container.innerHTML = '';
    }
  }

  function renderTimelineContent(data, container, requestStartedAt) {
    if (data.total === 0) {
      container.innerHTML = '';
      return;
    }

    var h = '<div class="tl-header">';
    h += '<span class="tl-title">Activity Timeline</span>';
    h += '<span class="tl-counts">';
    if (data.counts.queries > 0) h += '<span class="tl-count tl-count-query">' + data.counts.queries + ' quer' + (data.counts.queries === 1 ? 'y' : 'ies') + '</span>';
    if (data.counts.fetches > 0) h += '<span class="tl-count tl-count-fetch">' + data.counts.fetches + ' fetch' + (data.counts.fetches === 1 ? '' : 'es') + '</span>';
    if (data.counts.logs > 0) h += '<span class="tl-count tl-count-log">' + data.counts.logs + ' log' + (data.counts.logs === 1 ? '' : 's') + '</span>';
    if (data.counts.errors > 0) h += '<span class="tl-count tl-count-error">' + data.counts.errors + ' error' + (data.counts.errors === 1 ? '' : 's') + '</span>';
    h += '</span></div>';
    h += '<div class="tl-events">';

    var baseTs = data.timeline[0].timestamp;

    for (var i = 0; i < data.timeline.length; i++) {
      var evt = data.timeline[i];
      var color = TL_TYPE_COLORS[evt.type] || 'var(--text-dim)';
      var label = TL_TYPE_LABELS[evt.type] || evt.type;
      var relMs = Math.round(evt.timestamp - baseTs);
      var relStr = '+' + formatDuration(relMs);

      h += '<div class="tl-event" style="border-left-color:' + color + '">';
      h += '<span class="tl-event-time">' + relStr + '</span>';
      h += '<span class="tl-event-type" style="color:' + color + '">' + label + '</span>';
      h += renderTimelineEvent(evt);
      h += '</div>';
    }

    h += '</div>';
    container.innerHTML = h;
  }

  function renderTimelineEvent(evt) {
    var d = evt.data;
    if (evt.type === 'fetch') {
      var sCls = d.statusCode >= 400 ? ' style="color:var(--red)"' : '';
      return '<span class="tl-event-summary">' + escHtml(d.method) + ' ' + escHtml(d.url) + '</span>' +
             '<span class="tl-event-status"' + sCls + '>' + d.statusCode + '</span>' +
             '<span class="tl-event-dur">' + formatDuration(d.durationMs) + '</span>';
    }
    if (evt.type === 'query') {
      var info = d.sql ? simplifySQL(d.sql) : { op: d.operation || '?', table: d.model || '' };
      var opColor = QUERY_OP_COLORS[info.op] || 'var(--text-dim)';
      return '<span class="tl-event-summary"><span style="color:' + opColor + ';font-weight:600">' + escHtml(info.op) + '</span> ' + escHtml(info.table) + '</span>' +
             '<span class="tl-event-dur">' + queryDuration(d.durationMs) + '</span>';
    }
    if (evt.type === 'log') {
      var lColor = LOG_LEVEL_COLORS[d.level] || 'var(--text-dim)';
      return '<span class="tl-event-summary"><span style="color:' + lColor + '">' + d.level.toUpperCase() + '</span> ' + escHtml(d.message) + '</span>';
    }
    if (evt.type === 'error') {
      return '<span class="tl-event-summary" style="color:var(--red)">' + escHtml(d.name) + ': ' + escHtml(d.message) + '</span>';
    }
    return '';
  }

  function invalidateTimelineCache(requestId) {
    delete timelineCache[requestId];
  }

  function refreshVisibleTimeline(requestId) {
    var el = document.querySelector('.request-timeline[data-request-id="' + requestId + '"]');
    if (el && el.closest('.flow-expand.open, .req-detail.open')) {
      loadTimeline(requestId, el, 0);
    }
  }

  var timelineObserver = null;
  if (window.IntersectionObserver) {
    timelineObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var rid = el.getAttribute('data-request-id');
          var started = parseFloat(el.getAttribute('data-request-started'));
          if (rid && !el.hasAttribute('data-loaded')) {
            el.setAttribute('data-loaded', '1');
            loadTimeline(rid, el, started);
          }
          timelineObserver.unobserve(el);
        }
      });
    }, { rootMargin: '200px' });
  }

  function observeTimeline(el) {
    if (timelineObserver) {
      timelineObserver.observe(el);
    } else {
      var rid = el.getAttribute('data-request-id');
      var started = parseFloat(el.getAttribute('data-request-started'));
      loadTimeline(rid, el, started);
    }
  }
  `;
}
