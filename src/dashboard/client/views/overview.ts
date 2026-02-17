import {
  N1_QUERY_THRESHOLD,
  ERROR_RATE_THRESHOLD_PCT,
  SLOW_ENDPOINT_THRESHOLD_MS,
  MIN_REQUESTS_FOR_INSIGHT,
  HIGH_QUERY_COUNT_PER_REQ,
} from "../constants.js";

export function getOverviewView(): string {
  return `
  function computeInsights() {
    var insights = [];

    var nonStatic = state.requests.filter(function(r) {
      return !r.isStatic && (!r.path || r.path.indexOf('/_brakit') !== 0);
    });

    // --- N+1 Query Detection ---
    // Real N+1: a single request makes N identical query patterns (same op+table)
    // e.g., SELECT from users repeated 10x = fetching related data one by one
    // NOT flagged: 1 COUNT + 1 SELECT + 1 DELETE to same table = normal varied queries
    var queriesByReq = {};
    for (var qi = 0; qi < state.queries.length; qi++) {
      var q = state.queries[qi];
      if (!q.parentRequestId) continue;
      if (!queriesByReq[q.parentRequestId]) queriesByReq[q.parentRequestId] = [];
      queriesByReq[q.parentRequestId].push(q);
    }

    var reqById = {};
    for (var ri = 0; ri < nonStatic.length; ri++) {
      reqById[nonStatic[ri].id] = nonStatic[ri];
    }

    var n1Seen = {};
    for (var reqId in queriesByReq) {
      var reqQueries = queriesByReq[reqId];
      var req = reqById[reqId];
      if (!req) continue;
      var endpoint = req.method + ' ' + req.path;

      // Group by exact pattern (op + table) within THIS single request
      var patternCounts = {};
      for (var tqi = 0; tqi < reqQueries.length; tqi++) {
        var info = reqQueries[tqi].sql ? simplifySQL(reqQueries[tqi].sql) : { op: reqQueries[tqi].operation || '?', table: reqQueries[tqi].model || '' };
        var pattern = info.op + ':' + (info.table || 'unknown');
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      }

      // Flag when the SAME pattern repeats many times in one request
      // e.g., "SELECT:users" appearing 10x = classic N+1 loop
      for (var pat in patternCounts) {
        if (patternCounts[pat] > ${N1_QUERY_THRESHOLD}) {
          var parts = pat.split(':');
          var patOp = parts[0];
          var patTable = parts[1];
          var key = endpoint + ':' + pat;
          if (!n1Seen[key]) {
            n1Seen[key] = true;
            insights.push({
              severity: 'critical',
              type: 'n1',
              title: 'N+1 Query Pattern',
              desc: '<strong>' + escHtml(endpoint) + '</strong> runs ' + patternCounts[pat] + 'x <strong>' + escHtml(patOp + ' ' + patTable) + '</strong> in a single request',
              nav: 'queries'
            });
          }
        }
      }
    }

    // --- Unhandled Errors ---
    if (state.errors.length > 0) {
      var errGroups = {};
      for (var ei = 0; ei < state.errors.length; ei++) {
        var eName = state.errors[ei].name || 'Error';
        errGroups[eName] = (errGroups[eName] || 0) + 1;
      }
      for (var errName in errGroups) {
        var cnt = errGroups[errName];
        insights.push({
          severity: 'critical',
          type: 'error',
          title: 'Unhandled Error',
          desc: '<strong>' + escHtml(errName) + '</strong> — occurred ' + cnt + ' time' + (cnt !== 1 ? 's' : ''),
          nav: 'errors'
        });
      }
    }

    // --- Error Hotspots ---
    var endpointGroups = {};
    for (var gi = 0; gi < nonStatic.length; gi++) {
      var r = nonStatic[gi];
      var ep = r.method + ' ' + r.path;
      if (!endpointGroups[ep]) endpointGroups[ep] = { total: 0, errors: 0, totalDuration: 0, queryCount: 0 };
      endpointGroups[ep].total++;
      if (r.statusCode >= 400) endpointGroups[ep].errors++;
      endpointGroups[ep].totalDuration += r.durationMs;
      endpointGroups[ep].queryCount += (queriesByReq[r.id] || []).length;
    }

    for (var epKey in endpointGroups) {
      var g = endpointGroups[epKey];
      if (g.total < ${MIN_REQUESTS_FOR_INSIGHT}) continue;
      var errorRate = Math.round((g.errors / g.total) * 100);
      if (errorRate >= ${ERROR_RATE_THRESHOLD_PCT}) {
        insights.push({
          severity: 'critical',
          type: 'error-hotspot',
          title: 'Error Hotspot',
          desc: '<strong>' + escHtml(epKey) + '</strong> — ' + errorRate + '% error rate (' + g.errors + '/' + g.total + ' requests)',
          nav: 'requests'
        });
      }
    }

    // --- Duplicate API Calls (aggregated across flows) ---
    var dupCounts = {};
    var flowCount = {};
    for (var fi = 0; fi < state.flows.length; fi++) {
      var flow = state.flows[fi];
      if (!flow.requests) continue;
      var seenInFlow = {};
      for (var fri = 0; fri < flow.requests.length; fri++) {
        var fr = flow.requests[fri];
        if (!fr.isDuplicate) continue;
        var dupKey = fr.method + ' ' + (fr.label || fr.path || fr.url);
        dupCounts[dupKey] = (dupCounts[dupKey] || 0) + 1;
        if (!seenInFlow[dupKey]) {
          seenInFlow[dupKey] = true;
          flowCount[dupKey] = (flowCount[dupKey] || 0) + 1;
        }
      }
    }

    var dupEntries = [];
    for (var dk in dupCounts) dupEntries.push({ key: dk, count: dupCounts[dk], flows: flowCount[dk] || 0 });
    dupEntries.sort(function(a, b) { return b.count - a.count; });
    for (var di = 0; di < Math.min(dupEntries.length, 3); di++) {
      var d = dupEntries[di];
      insights.push({
        severity: 'warning',
        type: 'duplicate',
        title: 'Duplicate API Call',
        desc: '<strong>' + escHtml(d.key) + '</strong> loaded ' + d.count + 'x as duplicate across ' + d.flows + ' action' + (d.flows !== 1 ? 's' : ''),
        nav: 'actions'
      });
    }

    // --- Slow Endpoints ---
    for (var sepKey in endpointGroups) {
      var sg = endpointGroups[sepKey];
      if (sg.total < ${MIN_REQUESTS_FOR_INSIGHT}) continue;
      var avgMs = Math.round(sg.totalDuration / sg.total);
      if (avgMs >= ${SLOW_ENDPOINT_THRESHOLD_MS}) {
        insights.push({
          severity: 'warning',
          type: 'slow',
          title: 'Slow Endpoint',
          desc: '<strong>' + escHtml(sepKey) + '</strong> — avg ' + formatDuration(avgMs) + ' across ' + sg.total + ' request' + (sg.total !== 1 ? 's' : ''),
          nav: 'requests'
        });
      }
    }

    // --- Query-Heavy Endpoints ---
    for (var qhKey in endpointGroups) {
      var qg = endpointGroups[qhKey];
      if (qg.total < ${MIN_REQUESTS_FOR_INSIGHT}) continue;
      var avgQueries = Math.round(qg.queryCount / qg.total);
      if (avgQueries > ${HIGH_QUERY_COUNT_PER_REQ}) {
        insights.push({
          severity: 'warning',
          type: 'query-heavy',
          title: 'Query-Heavy Endpoint',
          desc: '<strong>' + escHtml(qhKey) + '</strong> — avg ' + avgQueries + ' queries/request',
          nav: 'queries'
        });
      }
    }

    // Sort: critical first, then by type for grouping
    var severityOrder = { critical: 0, warning: 1 };
    insights.sort(function(a, b) {
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    return insights;
  }

  function renderOverview() {
    var container = document.getElementById('overview-content');
    if (!container) return;
    container.innerHTML = '';

    var nonStatic = state.requests.filter(function(r) {
      return !r.isStatic && (!r.path || r.path.indexOf('/_brakit') !== 0);
    });

    var hasData = nonStatic.length > 0 || state.queries.length > 0 || state.errors.length > 0;

    if (!hasData) {
      container.innerHTML = '<div class="empty" style="height:400px"><span class="empty-title">Waiting for requests...</span><span class="empty-sub">Start using your app to see insights here</span></div>';
      return;
    }

    // Summary banner
    var errCount = nonStatic.filter(function(r) { return r.statusCode >= 400; }).length;
    var avgMs = nonStatic.length > 0 ? Math.round(nonStatic.reduce(function(s, r) { return s + r.durationMs; }, 0) / nonStatic.length) : 0;

    var summary = document.createElement('div');
    summary.className = 'ov-summary';
    summary.innerHTML =
      '<div class="ov-stat"><span class="ov-stat-value">' + nonStatic.length + '</span><span class="ov-stat-label">Requests</span></div>' +
      '<div class="ov-stat"><span class="ov-stat-value">' + state.flows.length + '</span><span class="ov-stat-label">Actions</span></div>' +
      '<div class="ov-stat"><span class="ov-stat-value">' + formatDuration(avgMs) + '</span><span class="ov-stat-label">Avg Response</span></div>' +
      '<div class="ov-stat"><span class="ov-stat-value">' + state.queries.length + '</span><span class="ov-stat-label">Queries</span></div>' +
      (errCount > 0
        ? '<div class="ov-stat"><span class="ov-stat-value" style="color:var(--red)">' + errCount + '</span><span class="ov-stat-label">Errors</span></div>'
        : '<div class="ov-stat"><span class="ov-stat-value" style="color:var(--green)">' + errCount + '</span><span class="ov-stat-label">Errors</span></div>') +
      '<div class="ov-stat"><span class="ov-stat-value">' + state.fetches.length + '</span><span class="ov-stat-label">Fetches</span></div>';
    container.appendChild(summary);

    // Compute insights
    var insights = computeInsights();

    if (insights.length === 0) {
      var clear = document.createElement('div');
      clear.className = 'ov-clear';
      clear.innerHTML = '<span class="ov-clear-icon">\\u2713</span>All clear — no issues detected';
      container.appendChild(clear);
      return;
    }

    // Section title
    var title = document.createElement('div');
    title.className = 'ov-section-title';
    title.innerHTML = 'Issues Found <span class="ov-issue-count">' + insights.length + '</span>';
    container.appendChild(title);

    // Cards
    var cards = document.createElement('div');
    cards.className = 'ov-cards';

    for (var i = 0; i < insights.length; i++) {
      (function(insight) {
        var card = document.createElement('div');
        card.className = 'ov-card';

        var iconCls = insight.severity === 'critical' ? 'critical' : 'warning';
        var iconChar = insight.severity === 'critical' ? '\\u2717' : '\\u26A0';

        card.innerHTML =
          '<span class="ov-card-icon ' + iconCls + '">' + iconChar + '</span>' +
          '<div class="ov-card-body">' +
            '<div class="ov-card-title">' + escHtml(insight.title) + '</div>' +
            '<div class="ov-card-desc">' + insight.desc + '</div>' +
          '</div>' +
          '<span class="ov-card-arrow">\\u2192</span>';

        card.addEventListener('click', function() {
          var navView = insight.nav;
          var sidebarItem = document.querySelector('.sidebar-item[data-view="' + navView + '"]');
          if (sidebarItem) sidebarItem.click();
        });

        cards.appendChild(card);
      })(insights[i]);
    }

    container.appendChild(cards);
  }
  `;
}
