import { SLOW_REQUEST_THRESHOLD_MS } from "../../../../constants/index.js";

export function getFlowInsights(): string {
  return `
  function createFlowInsights(flow) {
    var container = document.createElement('div');
    var traffic = document.createElement('div');
    traffic.className = 'flow-traffic';

    var skipCats = { 'auth-handshake': 1, 'auth-check': 1, 'middleware': 1 };

    for (var i = 0; i < flow.requests.length; i++) {
      var req = flow.requests[i];
      if (skipCats[req.category]) continue;
      var sClass = req.statusCode >= 500 ? 'status-pill-5xx' : req.statusCode >= 400 ? 'status-pill-4xx' : req.statusCode >= 300 ? 'status-pill-3xx' : 'status-pill-2xx';

      var card = document.createElement('div');
      card.className = 'traffic-card';

      var header = document.createElement('div');
      header.className = 'traffic-card-header';

      var mEl = document.createElement('span');
      mEl.className = 'method-badge method-badge-' + req.method;
      mEl.textContent = req.method;

      var pEl = document.createElement('span');
      pEl.className = 'traffic-card-path' + (req.isDuplicate ? ' is-dup' : '');
      pEl.textContent = req.label;

      var stEl = document.createElement('span');
      stEl.className = 'status-pill ' + sClass;
      stEl.textContent = String(req.statusCode);

      var dEl = document.createElement('span');
      dEl.className = 'traffic-card-dur';
      dEl.textContent = formatDuration(req.pollingDurationMs || req.durationMs);

      header.appendChild(mEl);
      header.appendChild(pEl);
      header.appendChild(stEl);
      header.appendChild(dEl);

      if (req.isDuplicate) {
        var dupEl = document.createElement('span');
        dupEl.className = 'traffic-card-dup';
        dupEl.textContent = 'duplicate';
        header.appendChild(dupEl);
      } else {
        var szEl = document.createElement('span');
        szEl.className = 'traffic-card-size';
        szEl.textContent = formatSize(req.responseSize);
        header.appendChild(szEl);
      }

      card.appendChild(header);

      var hasDetails = false;
      if (!req.isDuplicate && req.category !== 'static' && req.category !== 'polling') {
        var tlEl = document.createElement('div');
        tlEl.className = 'request-timeline tl-hidden';
        tlEl.setAttribute('data-request-id', req.id);
        tlEl.setAttribute('data-request-started', String(req.startedAt));
        card.appendChild(tlEl);
        hasDetails = true;
      }
      if (req.requestBody && req.method !== 'GET') {
        card.appendChild(buildBodyToggle('out', 'Request Body', req.requestBody));
        hasDetails = true;
      }
      if (req.responseBody) {
        card.appendChild(buildBodyToggle('in', 'Response Body', req.responseBody));
        hasDetails = true;
      }

      if (hasDetails) header.classList.add('has-details');

      traffic.appendChild(card);
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
