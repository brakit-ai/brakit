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
  CROSS_ENDPOINT_MIN_ENDPOINTS,
  CROSS_ENDPOINT_PCT,
  CROSS_ENDPOINT_MIN_OCCURRENCES,
  REDUNDANT_QUERY_MIN_COUNT,
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
              hint: 'This typically happens when fetching related data in a loop. Use a batch query, JOIN, or include/eager-load to fetch all records at once.',
              nav: 'queries'
            });
          }
        }
      }
    }

    // Cross-endpoint: same query shape appearing across many distinct endpoints
    var ceQueryMap = {};
    var ceAllEndpoints = {};
    for (var ceReqId in queriesByReq) {
      var ceReq = reqById[ceReqId];
      if (!ceReq) continue;
      var ceEndpoint = ceReq.method + ' ' + ceReq.path;
      ceAllEndpoints[ceEndpoint] = 1;
      var ceQueries = queriesByReq[ceReqId];
      var ceSeenInReq = {};
      for (var ceqi = 0; ceqi < ceQueries.length; ceqi++) {
        var ceq = ceQueries[ceqi];
        var ceNorm = ceq.sql ? normalizeQueryParams(ceq.sql) : null;
        var ceShape = ceNorm || ((ceq.operation || '?') + ':' + (ceq.model || ''));
        if (!ceQueryMap[ceShape]) ceQueryMap[ceShape] = { endpoints: {}, count: 0, first: ceq };
        ceQueryMap[ceShape].count++;
        if (!ceSeenInReq[ceShape]) {
          ceSeenInReq[ceShape] = true;
          ceQueryMap[ceShape].endpoints[ceEndpoint] = 1;
        }
      }
    }
    var ceTotalEndpoints = Object.keys(ceAllEndpoints).length;
    if (ceTotalEndpoints >= ${CROSS_ENDPOINT_MIN_ENDPOINTS}) {
      for (var ceShape in ceQueryMap) {
        var cem = ceQueryMap[ceShape];
        var ceEpCount = Object.keys(cem.endpoints).length;
        if (cem.count < ${CROSS_ENDPOINT_MIN_OCCURRENCES}) continue;
        if (ceEpCount < ${CROSS_ENDPOINT_MIN_ENDPOINTS}) continue;
        var cePct = Math.round((ceEpCount / ceTotalEndpoints) * 100);
        if (cePct < ${CROSS_ENDPOINT_PCT}) continue;
        var ceInfo = cem.first.sql ? simplifySQL(cem.first.sql) : { op: cem.first.operation || '?', table: cem.first.model || '' };
        var ceLabel = ceInfo.op + (ceInfo.table ? ' ' + ceInfo.table : '');
        var ceEpList = Object.keys(cem.endpoints);
        var ceDetailHtml = '';
        for (var ceEpi = 0; ceEpi < ceEpList.length; ceEpi++) {
          ceDetailHtml += '<div class="ov-detail-item">' + escHtml(ceEpList[ceEpi]) + '</div>';
        }
        insights.push({
          severity: 'warning',
          type: 'cross-endpoint',
          title: 'Repeated Query Across Endpoints',
          desc: '<strong>' + escHtml(ceLabel) + '</strong> runs on ' + ceEpCount + ' of ' + ceTotalEndpoints + ' endpoints (' + cePct + '%).',
          detail: '<div class="ov-detail-label">Affected endpoints:</div>' + ceDetailHtml,
          hint: 'This query runs on most of your endpoints. Load it once in middleware or cache the result to avoid redundant database calls.',
          nav: 'queries'
        });
      }
    }

    // Redundant queries: exact same query (same params) fired 2+ times in one request
    // Only checks queries with actual SQL — ORM-only queries (operation:model) can't
    // distinguish different params, so we'd get false positives on N+1-style calls.
    var rqSeen = {};
    for (var rqReqId in queriesByReq) {
      var rqReq = reqById[rqReqId];
      if (!rqReq) continue;
      var rqEndpoint = rqReq.method + ' ' + rqReq.path;
      var rqQueries = queriesByReq[rqReqId];
      var rqExact = {};
      for (var rqi = 0; rqi < rqQueries.length; rqi++) {
        var rqq = rqQueries[rqi];
        if (!rqq.sql) continue;
        var rqKey = rqq.sql;
        if (!rqExact[rqKey]) rqExact[rqKey] = { count: 0, first: rqq };
        rqExact[rqKey].count++;
      }
      for (var rqk in rqExact) {
        var rqe = rqExact[rqk];
        if (rqe.count < ${REDUNDANT_QUERY_MIN_COUNT}) continue;
        var rqInfo = rqe.first.sql ? simplifySQL(rqe.first.sql) : { op: rqe.first.operation || '?', table: rqe.first.model || '' };
        var rqLabel = rqInfo.op + (rqInfo.table ? ' ' + rqInfo.table : '');
        var rqDedup = rqEndpoint + ':' + rqLabel;
        if (rqSeen[rqDedup]) continue;
        rqSeen[rqDedup] = true;
        insights.push({
          severity: 'warning',
          type: 'redundant-query',
          title: 'Redundant Query',
          desc: '<strong>' + escHtml(rqLabel) + '</strong> runs ' + rqe.count + 'x with identical params in <strong>' + escHtml(rqEndpoint) + '</strong>.',
          hint: 'The exact same query with identical parameters runs multiple times in one request. Cache the first result or lift the query to a shared function.',
          nav: 'queries'
        });
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
          hint: 'Unhandled errors crash request handlers. Wrap async code in try/catch or add error-handling middleware.',
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
          hint: 'This endpoint frequently returns errors. Check the response bodies for error details and stack traces.',
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
        hint: 'Multiple components independently fetch the same endpoint. Lift the fetch to a parent component, use a data cache, or deduplicate with React Query / SWR.',
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
          hint: 'Consistently slow responses hurt user experience. Check the Queries tab to see if database queries are the bottleneck.',
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
          hint: 'Too many queries per request increases latency. Combine queries with JOINs, use batch operations, or reduce the number of data fetches.',
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
            hint: 'Auth checks consume a significant portion of this action. If using a third-party auth provider, check if session caching can reduce roundtrips.',
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
          desc: '<strong>SELECT *</strong> on <strong>' + escHtml(ssKey) + '</strong> \\u2014 ' + selectStarSeen[ssKey] + ' occurrence' + (selectStarSeen[ssKey] !== 1 ? 's' : ''),
          hint: 'SELECT * fetches all columns including ones you don\\u2019t need. Specify only required columns to reduce data transfer and memory usage.',
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
          desc: '<strong>' + escHtml(hrk) + '</strong> returns ' + hrs.max + '+ rows (' + hrs.count + 'x)',
          hint: 'Fetching many rows slows responses and wastes memory. Add a LIMIT clause, implement pagination, or filter with a WHERE condition.',
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
          desc: '<strong>' + escHtml(lrKey) + '</strong> \\u2014 avg ' + formatSize(lrAvg) + ' response',
          hint: 'Large API responses increase network transfer time. Implement pagination, field filtering, or response compression.',
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
