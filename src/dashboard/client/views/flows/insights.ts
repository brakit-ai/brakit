import { SLOW_REQUEST_THRESHOLD_MS } from "../../../../constants/index.js";

export function getFlowInsights(): string {
  return `
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
  `;
}
