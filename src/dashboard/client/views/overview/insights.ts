import {
  N1_QUERY_THRESHOLD,
  ERROR_RATE_THRESHOLD_PCT,
  SLOW_ENDPOINT_THRESHOLD_MS,
  MIN_REQUESTS_FOR_INSIGHT,
  HIGH_QUERY_COUNT_PER_REQ,
  AUTH_OVERHEAD_PCT,
  LARGE_RESPONSE_BYTES,
  HIGH_ROW_COUNT,
  OVERFETCH_MIN_REQUESTS,
} from "../../constants.js";
import { DASHBOARD_PREFIX } from "../../../../constants/index.js";

export function getOverviewInsights(): string {
  return `
  function computeInsights() {
    var insights = [];

    var nonStatic = state.requests.filter(function(r) {
      return !r.isStatic && (!r.path || r.path.indexOf('${DASHBOARD_PREFIX}') !== 0);
    });

    // N+1: same query shape with different parameter values in a single request
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

    function normalizeQueryParams(sql) {
      if (!sql) return null;
      var n = sql.replace(/'[^']*'/g, '?');
      n = n.replace(/\\b\\d+(\\.\\d+)?\\b/g, '?');
      n = n.replace(/\\$\\d+/g, '?');
      return n;
    }

    var n1Seen = {};
    for (var reqId in queriesByReq) {
      var reqQueries = queriesByReq[reqId];
      var req = reqById[reqId];
      if (!req) continue;
      var endpoint = req.method + ' ' + req.path;

      var shapeGroups = {};
      for (var tqi = 0; tqi < reqQueries.length; tqi++) {
        var tq = reqQueries[tqi];
        var normalized = tq.sql ? normalizeQueryParams(tq.sql) : null;
        var shape = normalized || ((tq.operation || '?') + ':' + (tq.model || ''));
        if (!shapeGroups[shape]) shapeGroups[shape] = { count: 0, distinctSql: {}, first: tq };
        shapeGroups[shape].count++;
        var sqlKey = tq.sql || shape;
        shapeGroups[shape].distinctSql[sqlKey] = 1;
      }

      for (var shape in shapeGroups) {
        var sg = shapeGroups[shape];
        var distinctCount = Object.keys(sg.distinctSql).length;
        if (sg.count > ${N1_QUERY_THRESHOLD} && distinctCount > 1) {
          var info = sg.first.sql ? simplifySQL(sg.first.sql) : { op: sg.first.operation || '?', table: sg.first.model || '' };
          var key = endpoint + ':' + info.op + ':' + (info.table || 'unknown');
          if (!n1Seen[key]) {
            n1Seen[key] = true;
            insights.push({
              severity: 'critical',
              type: 'n1',
              title: 'N+1 Query Pattern',
              desc: '<strong>' + escHtml(endpoint) + '</strong> runs ' + sg.count + 'x <strong>' + escHtml(info.op + ' ' + info.table) + '</strong> with different params in a single request',
              nav: 'queries'
            });
          }
        }
      }
    }

    // Unhandled Errors
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

    // Error Hotspots
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

    // Duplicate API Calls
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

    // Slow Endpoints
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

    // Query-Heavy Endpoints
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

    // Auth Overhead
    var authCats = { 'auth-handshake': 1, 'auth-check': 1, 'middleware': 1 };
    for (var afi = 0; afi < state.flows.length; afi++) {
      var af = state.flows[afi];
      if (!af.requests || af.requests.length < 2) continue;
      var afAuthMs = 0;
      var afTotalMs = 0;
      for (var ari = 0; ari < af.requests.length; ari++) {
        var ar = af.requests[ari];
        var arDur = ar.pollingDurationMs || ar.durationMs;
        afTotalMs += arDur;
        if (authCats[ar.category]) afAuthMs += arDur;
      }
      if (afTotalMs > 0 && afAuthMs > 0) {
        var afPct = Math.round((afAuthMs / afTotalMs) * 100);
        if (afPct >= ${AUTH_OVERHEAD_PCT}) {
          insights.push({
            severity: 'warning',
            type: 'auth-overhead',
            title: 'Auth Overhead',
            desc: '<strong>' + escHtml(af.label) + '</strong> \\u2014 ' + afPct + '% of time (' + formatDuration(afAuthMs) + ') spent in auth/middleware',
            nav: 'actions'
          });
        }
      }
    }

    // Over-fetching: SELECT * queries
    var selectStarSeen = {};
    for (var sqReqId in queriesByReq) {
      var sqQueries = queriesByReq[sqReqId];
      for (var sqi = 0; sqi < sqQueries.length; sqi++) {
        var sq = sqQueries[sqi];
        if (!sq.sql) continue;
        var sqlUp = sq.sql.trim();
        var isSelectStar = /^SELECT\\s+\\*/i.test(sqlUp) || /\\.\\*\\s+FROM/i.test(sqlUp);
        if (isSelectStar) {
          var sqInfo = simplifySQL(sq.sql);
          var sqKey = sqInfo.table || 'unknown';
          if (!selectStarSeen[sqKey]) {
            selectStarSeen[sqKey] = 0;
          }
          selectStarSeen[sqKey]++;
        }
      }
    }
    for (var ssKey in selectStarSeen) {
      if (selectStarSeen[ssKey] >= ${OVERFETCH_MIN_REQUESTS}) {
        insights.push({
          severity: 'warning',
          type: 'select-star',
          title: 'SELECT * Query',
          desc: '<strong>SELECT *</strong> on <strong>' + escHtml(ssKey) + '</strong> \\u2014 ' + selectStarSeen[ssKey] + ' occurrence' + (selectStarSeen[ssKey] !== 1 ? 's' : '') + '. Select only the columns you need.',
          nav: 'queries'
        });
      }
    }

    // Over-fetching: High row counts
    var highRowSeen = {};
    for (var hrReqId in queriesByReq) {
      var hrQueries = queriesByReq[hrReqId];
      for (var hri = 0; hri < hrQueries.length; hri++) {
        var hq = hrQueries[hri];
        if (hq.rowCount && hq.rowCount > ${HIGH_ROW_COUNT}) {
          var hrInfo = hq.sql ? simplifySQL(hq.sql) : { op: hq.operation || '?', table: hq.model || '' };
          var hrKey = hrInfo.op + ' ' + (hrInfo.table || 'unknown');
          if (!highRowSeen[hrKey]) highRowSeen[hrKey] = { max: 0, count: 0 };
          highRowSeen[hrKey].count++;
          if (hq.rowCount > highRowSeen[hrKey].max) highRowSeen[hrKey].max = hq.rowCount;
        }
      }
    }
    for (var hrk in highRowSeen) {
      var hrs = highRowSeen[hrk];
      if (hrs.count >= ${OVERFETCH_MIN_REQUESTS}) {
        insights.push({
          severity: 'warning',
          type: 'high-rows',
          title: 'Large Result Set',
          desc: '<strong>' + escHtml(hrk) + '</strong> returns ' + hrs.max + '+ rows (' + hrs.count + 'x). Consider pagination or adding a LIMIT.',
          nav: 'queries'
        });
      }
    }

    // Over-fetching: Large API responses
    for (var lrKey in endpointGroups) {
      var lr = endpointGroups[lrKey];
      if (lr.total < ${OVERFETCH_MIN_REQUESTS}) continue;
      var lrTotalSize = 0;
      for (var lri = 0; lri < nonStatic.length; lri++) {
        var lrr = nonStatic[lri];
        if ((lrr.method + ' ' + lrr.path) === lrKey) lrTotalSize += lrr.responseSize || 0;
      }
      var lrAvg = Math.round(lrTotalSize / lr.total);
      if (lrAvg > ${LARGE_RESPONSE_BYTES}) {
        insights.push({
          severity: 'info',
          type: 'large-response',
          title: 'Large Response',
          desc: '<strong>' + escHtml(lrKey) + '</strong> \\u2014 avg ' + formatSize(lrAvg) + ' response. Consider pagination or field filtering.',
          nav: 'requests'
        });
      }
    }

    // Security Rules
    var secFindings = computeSecurityFindings();
    for (var si = 0; si < secFindings.length; si++) {
      insights.push(secFindings[si]);
    }

    var severityOrder = { critical: 0, warning: 1, info: 2 };
    insights.sort(function(a, b) {
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    return insights;
  }
  `;
}
