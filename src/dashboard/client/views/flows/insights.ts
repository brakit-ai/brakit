import { SLOW_REQUEST_THRESHOLD_MS } from "../../../../constants/index.js";
import {
  AUTH_OVERHEAD_PCT,
  AUTH_SLOW_MS,
  LARGE_RESPONSE_BYTES,
  AUTH_SKIP_CATEGORIES,
} from "../../constants/index.js";

export function getFlowInsights(): string {
  return `
  var skipCats = ${AUTH_SKIP_CATEGORIES};

  function createFlowInsights(flow) {
    var container = document.createElement('div');
    var traffic = document.createElement('div');
    traffic.className = 'flow-traffic';

    for (var i = 0; i < flow.requests.length; i++) {
      var req = flow.requests[i];
      if (skipCats[req.category]) continue;
      var sClass = statusPillClass(req.statusCode);

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

      if (req.isStrictModeDupe) {
        card.classList.add('strict-mode-dupe');
        var smBanner = document.createElement('div');
        smBanner.className = 'strict-mode-banner';
        smBanner.textContent = 'React Strict Mode duplicate \\u2014 does not happen in production';
        card.appendChild(smBanner);
      }

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
    var hasIssues = insights.errors.length > 0 || insights.duplicates.length > 0 || insights.warnings.length > 0 || !!insights.tip;
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
      for (var wi = 0; wi < insights.warnings.length; wi++) {
        var warnLine = document.createElement('div');
        warnLine.className = 'insight-line insight-warn';
        warnLine.textContent = '\\u26A0 ' + insights.warnings[wi];
        insightsEl.appendChild(warnLine);
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
    var warnings = [];
    var duplicates = [];
    var seen = new Map();
    var authMs = 0;
    var totalMs = 0;
    for (var i = 0; i < reqs.length; i++) {
      var req = reqs[i];
      var label = req.label;
      var dur = req.pollingDurationMs || req.durationMs;
      totalMs += dur;

      if (skipCats[req.category]) {
        authMs += dur;
        if (dur > ${AUTH_SLOW_MS}) {
          warnings.push('Slow auth: ' + label + ' took ' + formatDuration(dur));
        }
        continue;
      }

      if (req.isDuplicate) {
        var ex = seen.get(label);
        if (ex) { ex.count++; ex.wastedMs += dur; }
        else seen.set(label, { name: label, count: 2, wastedMs: dur });
        continue;
      }
      if (req.statusCode >= 400) {
        errors.push(label + ' (' + httpStatus(req.statusCode) + ')');
        continue;
      }

      if (req.responseSize > ${LARGE_RESPONSE_BYTES}) {
        warnings.push('Large response: ' + label + ' returned ' + formatSize(req.responseSize));
      }

      successes.push(label);
    }

    if (totalMs > 0 && authMs > 0) {
      var authPct = Math.round((authMs / totalMs) * 100);
      if (authPct >= ${AUTH_OVERHEAD_PCT}) {
        warnings.unshift('Auth overhead: ' + authPct + '% of this action (' + formatDuration(authMs) + ') is spent in auth/middleware');
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
    return { successes: successes, errors: errors, warnings: warnings, duplicates: duplicates, tip: tip };
  }
  `;
}
