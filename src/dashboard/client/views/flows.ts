import {
  SLOW_REQUEST_THRESHOLD_MS,
  DASHBOARD_API_FETCHES,
  DASHBOARD_API_LOGS,
  DASHBOARD_API_ERRORS,
  DASHBOARD_API_QUERIES,
} from "../../../constants.js";

export function getFlowsView(): string {
  return `
  var flowColHeader = document.getElementById('flow-col-header');
  function renderFlows() {
    flowListEl.innerHTML = '';
    if (state.flows.length === 0) {
      flowListEl.appendChild(emptyFlows);
      emptyFlows.style.display = 'flex';
      if (flowColHeader) flowColHeader.style.display = 'none';
      return;
    }
    emptyFlows.style.display = 'none';
    if (flowColHeader) flowColHeader.style.display = 'flex';
    for (var i = 0; i < state.flows.length; i++) {
      var result = createFlowRow(state.flows[i]);
      flowListEl.appendChild(result.row);
      flowListEl.appendChild(result.expand);
    }
  }

  function flowDotClass(flow) {
    if (flow.hasErrors) return 'dot-error';
    if (flow.redundancyPct > 0) return 'dot-warn';
    return 'dot-clean';
  }

  function flowBadgeText(flow) {
    if (flow.hasErrors) {
      var errCount = flow.requests.filter(function(r){ return r.statusCode >= 400; }).length;
      return { text: errCount + ' error' + (errCount !== 1 ? 's' : ''), cls: 'has-error' };
    }
    if (flow.redundancyPct > 0) {
      return { text: flow.redundancyPct + '% redundant', cls: 'has-warn' };
    }
    return { text: 'clean', cls: '' };
  }

  function createFlowRow(flow) {
    var row = document.createElement('div');
    row.className = 'flow-row';
    var summary = document.createElement('div');
    summary.className = 'flow-summary-row';
    var dot = document.createElement('span');
    dot.className = 'flow-status-dot ' + flowDotClass(flow);
    var label = document.createElement('span');
    label.className = 'flow-label';
    label.textContent = flow.label;
    var count = document.createElement('span');
    count.className = 'flow-req-count';
    count.textContent = flow.requests.length + ' req' + (flow.requests.length !== 1 ? 's' : '');
    var badgeInfo = flowBadgeText(flow);
    var badge = document.createElement('span');
    badge.className = 'flow-badge-text' + (badgeInfo.cls ? ' ' + badgeInfo.cls : '');
    badge.textContent = badgeInfo.text;
    var dur = document.createElement('span');
    dur.className = 'flow-duration';
    dur.textContent = formatDuration(flow.totalDurationMs);
    summary.appendChild(dot);
    summary.appendChild(label);
    summary.appendChild(count);
    summary.appendChild(badge);
    summary.appendChild(dur);
    row.appendChild(summary);

    var expand = document.createElement('div');
    expand.className = 'flow-expand';

    row.addEventListener('click', function() {
      var wasOpen = row.classList.contains('expanded');
      document.querySelectorAll('.flow-row.expanded').forEach(function(r){ r.classList.remove('expanded'); });
      document.querySelectorAll('.flow-expand.open').forEach(function(d){ d.classList.remove('open'); });
      if (!wasOpen) {
        row.classList.add('expanded');
        expand.classList.add('open');
        expand.innerHTML = '';
        if (state.viewMode === 'simple') {
          expand.appendChild(createFlowInsights(flow));
        } else {
          expand.appendChild(createFlowSubReqs(flow));
        }
      }
    });

    return { row: row, expand: expand };
  }

  function createFlowInsights(flow) {
    var container = document.createElement('div');
    var traffic = document.createElement('div');
    traffic.className = 'flow-traffic';
    var tHeader = document.createElement('div');
    tHeader.className = 'traffic-row traffic-header';
    tHeader.innerHTML = '<span class="t-method">Method</span><span class="t-path">Request</span><span class="t-status">Code</span><span class="t-dur">Time</span><span class="t-size">Size</span>';
    traffic.appendChild(tHeader);

    var skipCats = { 'auth-handshake': 1, 'auth-check': 1, 'middleware': 1 };

    for (var i = 0; i < flow.requests.length; i++) {
      var req = flow.requests[i];
      if (skipCats[req.category]) continue;
      var sClass = req.statusCode >= 500 ? 'status-5xx' : req.statusCode >= 400 ? 'status-4xx' : req.statusCode >= 300 ? 'status-3xx' : 'status-2xx';
      var row = document.createElement('div');
      row.className = 'traffic-row';
      var mEl = document.createElement('span');
      mEl.className = 't-method method-' + req.method;
      mEl.textContent = req.method;
      var pEl = document.createElement('span');
      pEl.className = 't-path' + (req.isDuplicate ? ' is-dup' : '');
      pEl.textContent = req.label;
      var stEl = document.createElement('span');
      stEl.className = 't-status ' + sClass;
      stEl.textContent = String(req.statusCode);
      var dEl = document.createElement('span');
      dEl.className = 't-dur';
      dEl.textContent = formatDuration(req.pollingDurationMs || req.durationMs);
      row.appendChild(mEl);
      row.appendChild(pEl);
      row.appendChild(stEl);
      row.appendChild(dEl);
      if (req.isDuplicate) {
        var dupEl = document.createElement('span');
        dupEl.className = 't-dup';
        dupEl.textContent = 'dup';
        row.appendChild(dupEl);
      } else {
        var szEl = document.createElement('span');
        szEl.className = 't-size';
        szEl.textContent = formatSize(req.responseSize);
        row.appendChild(szEl);
      }
      traffic.appendChild(row);
      if (req.requestBody && req.method !== 'GET') {
        traffic.appendChild(buildBodyToggle('out', 'Request Body', req.requestBody));
      }
      if (req.responseBody) {
        traffic.appendChild(buildBodyToggle('in', 'Response Body', req.responseBody));
      }
      if (i < flow.requests.length - 1) {
        var sep = document.createElement('div');
        sep.className = 'traffic-separator';
        traffic.appendChild(sep);
      }
    }

    container.appendChild(traffic);

    var insights = analyzeFlow(flow);
    var hasIssues = insights.errors.length > 0 || insights.duplicates.length > 0 || !!insights.tip;
    if (hasIssues) {
      var divider = document.createElement('div');
      divider.className = 'flow-divider';
      container.appendChild(divider);
      var insightsEl = document.createElement('div');
      insightsEl.className = 'flow-insights';
      for (var ei = 0; ei < insights.errors.length; ei++) {
        var errLine = document.createElement('div');
        errLine.className = 'insight-line insight-error';
        errLine.textContent = '\\u2717 ' + insights.errors[ei];
        insightsEl.appendChild(errLine);
      }
      for (var di = 0; di < insights.duplicates.length; di++) {
        var dup = insights.duplicates[di];
        var dupLine = document.createElement('div');
        dupLine.className = 'insight-line insight-warn';
        dupLine.textContent = '\\u26A0 ' + dup.name + ' \\u2014 loaded ' + dup.count + 'x (wasting ~' + formatDuration(dup.wastedMs) + ')';
        insightsEl.appendChild(dupLine);
      }
      if (insights.tip) {
        var tipLine = document.createElement('div');
        tipLine.className = 'insight-line insight-tip';
        tipLine.textContent = 'Tip: ' + insights.tip;
        insightsEl.appendChild(tipLine);
      }
      container.appendChild(insightsEl);
    }

    return container;
  }

  function analyzeFlow(flow) {
    var reqs = flow.requests;
    var successes = [];
    var errors = [];
    var duplicates = [];
    var seen = new Map();
    for (var i = 0; i < reqs.length; i++) {
      var req = reqs[i];
      var label = req.label;
      if (req.isDuplicate) {
        var ex = seen.get(label);
        if (ex) { ex.count++; ex.wastedMs += req.pollingDurationMs || req.durationMs; }
        else seen.set(label, { name: label, count: 2, wastedMs: req.pollingDurationMs || req.durationMs });
        continue;
      }
      if (req.statusCode >= 400) {
        errors.push(label + ' (' + httpStatus(req.statusCode) + ')');
        continue;
      }
      if (req.category !== 'auth-handshake' && req.category !== 'auth-check' && req.category !== 'middleware') {
        successes.push(label);
      }
    }
    for (var d of seen.values()) duplicates.push(d);
    var tip = '';
    if (duplicates.length > 0) {
      var names = duplicates.map(function(d) { return d.name; }).join(', ');
      var totalWaste = duplicates.reduce(function(s, d) { return s + d.wastedMs; }, 0);
      tip = 'Your app fetches ' + names + ' multiple times on this page. This wastes ~' + formatDuration(totalWaste) + '. Try caching these calls, deduplicating with React Query/SWR, or moving them to a shared layout.';
    } else if (errors.length > 0) {
      tip = 'Some requests are failing. Check your API routes and make sure the endpoints exist.';
    }
    var slow = reqs.filter(function(r) { return r.durationMs > ${SLOW_REQUEST_THRESHOLD_MS} && r.category !== 'polling'; });
    if (slow.length > 0 && !tip) {
      tip = slow.map(function(r) { return r.label; }).join(', ') + ' is taking over 2 seconds. Consider adding caching or optimizing the backend query.';
    }
    return { successes: successes, errors: errors, duplicates: duplicates, tip: tip };
  }

  function createFlowSubReqs(flow) {
    var container = document.createElement('div');
    container.className = 'flow-subreqs';
    flow.requests.forEach(function(req) {
      var isDup = req.isDuplicate;
      var sClass = req.statusCode >= 500 ? 'status-5xx' : req.statusCode >= 400 ? 'status-4xx' : req.statusCode >= 300 ? 'status-3xx' : 'status-2xx';
      var subRow = document.createElement('div');
      subRow.className = 'flow-subreq';
      var methodEl = document.createElement('span');
      methodEl.className = 'subreq-method method-' + req.method;
      methodEl.textContent = req.method;
      var labelEl = document.createElement('span');
      labelEl.className = 'subreq-label' + (isDup ? ' is-dup' : '');
      labelEl.textContent = req.path || req.url;
      var statusEl = document.createElement('span');
      statusEl.className = 'subreq-status ' + sClass;
      statusEl.textContent = String(req.statusCode);
      var durEl = document.createElement('span');
      durEl.className = 'subreq-dur';
      durEl.textContent = req.pollingDurationMs ? formatDuration(req.pollingDurationMs) : formatDuration(req.durationMs);
      subRow.appendChild(methodEl);
      subRow.appendChild(labelEl);
      if (isDup) {
        var dupTag = document.createElement('span');
        dupTag.className = 'subreq-dup-tag';
        dupTag.textContent = 'dup';
        subRow.appendChild(dupTag);
      }
      subRow.appendChild(statusEl);
      subRow.appendChild(durEl);

      var detail = document.createElement('div');
      detail.className = 'flow-subreq-detail';
      subRow.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = detail.classList.contains('open');
        container.querySelectorAll('.flow-subreq-detail.open').forEach(function(d){ d.classList.remove('open'); });
        container.querySelectorAll('.flow-subreq.expanded').forEach(function(r){ r.classList.remove('expanded'); });
        if (!wasOpen) {
          subRow.classList.add('expanded');
          detail.classList.add('open');
          detail.innerHTML = renderDetail(req);
          var curlBtn = detail.querySelector('.btn-curl');
          if (curlBtn) curlBtn.addEventListener('click', function(ev) { ev.stopPropagation(); copyAsCurl(req); });
          var saEl = detail.querySelector('.server-activity');
          if (saEl) loadServerActivity(saEl);
        }
      });
      container.appendChild(subRow);
      container.appendChild(detail);
    });
    return container;
  }

  function renderDetail(req) {
    var h = '<div class="detail-meta">';
    h += '<span><strong>' + req.method + '</strong> ' + escHtml(req.url) + '</span>';
    h += '<span>Status: ' + req.statusCode + '</span>';
    h += '<span>' + req.durationMs + 'ms</span>';
    if (req.responseSize) h += '<span>' + formatSize(req.responseSize) + '</span>';
    h += '</div>';
    h += '<div class="server-activity" data-request-id="' + req.id + '"><div class="server-activity-loading" style="color:var(--dim);padding:8px 0;font-size:12px">Loading server activity...</div></div>';
    h += '<div class="detail-grid">';
    h += '<div class="detail-section"><h4>Request Headers</h4><pre>' + formatHeaders(req.headers) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Headers</h4><pre>' + formatHeaders(req.responseHeaders) + '</pre></div>';
    h += '<div class="detail-section"><h4>Request Body</h4><pre>' + formatJsonBody(req.requestBody) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Body</h4><pre>' + formatJsonBody(req.responseBody) + '</pre></div>';
    h += '</div>';
    h += '<div class="detail-actions"><button class="btn btn-curl">Copy cURL</button></div>';
    return h;
  }

  async function loadServerActivity(container) {
    var rid = container.getAttribute('data-request-id');
    if (!rid) return;
    try {
      var results = await Promise.all([
        fetch('${DASHBOARD_API_FETCHES}?requestId=' + rid).then(function(r) { return r.json(); }),
        fetch('${DASHBOARD_API_LOGS}?requestId=' + rid).then(function(r) { return r.json(); }),
        fetch('${DASHBOARD_API_ERRORS}?requestId=' + rid).then(function(r) { return r.json(); }),
        fetch('${DASHBOARD_API_QUERIES}?requestId=' + rid).then(function(r) { return r.json(); })
      ]);
      var fetches = results[0].entries || [];
      var logs = results[1].entries || [];
      var errors = results[2].entries || [];
      var queries = results[3].entries || [];
      if (fetches.length === 0 && logs.length === 0 && errors.length === 0 && queries.length === 0) {
        container.innerHTML = '';
        return;
      }
      var h = '<div class="server-activity-header">Server Activity</div>';
      if (fetches.length > 0) {
        h += '<div class="sa-section"><div class="sa-label">Fetches (' + fetches.length + ')</div>';
        for (var i = 0; i < fetches.length; i++) {
          var f = fetches[i];
          var sCls = f.statusCode >= 400 ? ' style="color:var(--red)"' : '';
          h += '<div class="sa-row">' +
            '<span class="sa-method">' + escHtml(f.method) + '</span>' +
            '<span class="sa-url" title="' + escHtml(f.url) + '">' + escHtml(f.url) + '</span>' +
            '<span class="sa-status"' + sCls + '>' + f.statusCode + '</span>' +
            '<span class="sa-dur">' + formatDuration(f.durationMs) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      if (logs.length > 0) {
        h += '<div class="sa-section"><div class="sa-label">Logs (' + logs.length + ')</div>';
        for (var j = 0; j < logs.length; j++) {
          var l = logs[j];
          var lColor = LOG_LEVEL_COLORS[l.level] || 'var(--fg)';
          h += '<div class="sa-row">' +
            '<span class="sa-level" style="color:' + lColor + '">' + l.level.toUpperCase() + '</span>' +
            '<span class="sa-msg" title="' + escHtml(l.message) + '">' + escHtml(l.message) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      if (queries.length > 0) {
        h += '<div class="sa-section"><div class="sa-label">Queries (' + queries.length + ')</div>';
        for (var qi = 0; qi < queries.length; qi++) {
          var q = queries[qi];
          var qInfo = q.sql ? simplifySQL(q.sql) : { op: q.operation || '?', table: q.model || '', summary: (q.model ? q.model + '.' : '') + (q.operation || '?') };
          var qOpColor = QUERY_OP_COLORS[qInfo.op] || 'var(--fg)';
          var qSlow = q.durationMs > 100 ? ' style="color:var(--red)"' : '';
          h += '<div class="sa-row">' +
            '<span class="sa-method" style="color:' + qOpColor + '">' + escHtml(qInfo.op) + '</span>' +
            '<span class="sa-url">' + escHtml(qInfo.table) + '</span>' +
            '<span class="sa-dur"' + qSlow + '>' + queryDuration(q.durationMs) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      if (errors.length > 0) {
        h += '<div class="sa-section"><div class="sa-label" style="color:var(--red)">Errors (' + errors.length + ')</div>';
        for (var k = 0; k < errors.length; k++) {
          var e = errors[k];
          h += '<div class="sa-row">' +
            '<span class="sa-err-name">' + escHtml(e.name) + '</span>' +
            '<span class="sa-msg" title="' + escHtml(e.message) + '">' + escHtml(e.message) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      container.innerHTML = h;
    } catch(ex) {
      container.innerHTML = '';
    }
  }
  `;
}
