import type { BrakitConfig } from "../types.js";

export function getClientScript(config: BrakitConfig): string {
  return `
(function(){
  const PORT = ${config.proxyPort};
  const state = { flows: [], requests: [], viewMode: 'simple', activeView: 'actions' };

  const appEl = document.getElementById('app');
  const flowListEl = document.getElementById('flow-list');
  const reqListEl = document.getElementById('request-list');
  const emptyFlows = document.getElementById('empty-flows');
  const toastEl = document.getElementById('toast');

  // ===== INIT =====
  async function init() {
    try {
      const res = await fetch('/__brakit/api/flows');
      const data = await res.json();
      state.flows = data.flows;
      renderFlows();
    } catch(e) { console.error('Failed to load flows', e); }

    try {
      const res = await fetch('/__brakit/api/requests');
      const data = await res.json();
      state.requests = data.requests;
      renderRequests();
    } catch(e) {}

    updateStats();

    const events = new EventSource('/__brakit/api/events');
    let reloadTimer = null;
    events.onmessage = (e) => {
      const req = JSON.parse(e.data);
      if (req.path && req.path.startsWith('/__brakit')) return;
      state.requests.unshift(req);
      if (state.requests.length > 1000) state.requests.pop();
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reloadFlows, 300);
      prependRequestRow(req);
      updateStats();
    };
  }

  async function reloadFlows() {
    try {
      const res = await fetch('/__brakit/api/flows');
      const data = await res.json();
      state.flows = data.flows;
      renderFlows();
      updateStats();
    } catch(e) {}
  }

  // ===== STATUS =====
  function statusIcon(code) {
    if (code >= 500) return { icon: '\\u2717', cls: 'status-error', tip: code + ' Server Error' };
    if (code >= 400) return { icon: '\\u2717', cls: 'status-fail', tip: code + ' ' + httpStatus(code) };
    if (code >= 300) return { icon: '\\u2713', cls: 'status-ok', tip: code + ' Redirect' };
    return { icon: '\\u2713', cls: 'status-ok', tip: code + ' OK' };
  }

  function httpStatus(code) {
    const map = {400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',408:'Timeout',409:'Conflict',422:'Unprocessable',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'};
    return map[code] || (code >= 500 ? 'Server Error' : code >= 400 ? 'Client Error' : 'OK');
  }

  // ===== FLOW VIEW =====
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

  // ===== SIMPLE =====
  function createFlowInsights(flow) {
    var container = document.createElement('div');

    // Block 1: Traffic table
    var traffic = document.createElement('div');
    traffic.className = 'flow-traffic';

    // Traffic column header
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

      // Request body (non-GET only)
      if (req.requestBody && req.method !== 'GET') {
        traffic.appendChild(buildBodyToggle('out', 'Request Body', req.requestBody));
      }

      // Response body
      if (req.responseBody) {
        traffic.appendChild(buildBodyToggle('in', 'Response Body', req.responseBody));
      }

      // Separator between requests
      if (i < flow.requests.length - 1) {
        var sep = document.createElement('div');
        sep.className = 'traffic-separator';
        traffic.appendChild(sep);
      }
    }

    container.appendChild(traffic);

    // Block 2: Insights (only if there are issues)
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
    const reqs = flow.requests;
    const successes = [];
    const errors = [];
    const duplicates = [];
    const seen = new Map();

    for (const req of reqs) {
      const label = req.label;
      if (req.isDuplicate) {
        const ex = seen.get(label);
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
    for (const d of seen.values()) duplicates.push(d);

    let tip = '';
    if (duplicates.length > 0) {
      const names = duplicates.map(d => d.name).join(', ');
      const totalWaste = duplicates.reduce((s, d) => s + d.wastedMs, 0);
      tip = 'Your app fetches ' + names + ' multiple times on this page. This wastes ~' + formatDuration(totalWaste) + '. Try caching these calls, deduplicating with React Query/SWR, or moving them to a shared layout.';
    } else if (errors.length > 0) {
      tip = 'Some requests are failing. Check your API routes and make sure the endpoints exist.';
    }
    const slow = reqs.filter(r => r.durationMs > 2000 && r.category !== 'polling');
    if (slow.length > 0 && !tip) {
      tip = slow.map(r => r.label).join(', ') + ' is taking over 2 seconds. Consider adding caching or optimizing the backend query.';
    }
    return { successes, errors, duplicates, tip };
  }

  // ===== DETAILED =====
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
        }
      });

      container.appendChild(subRow);
      container.appendChild(detail);
    });

    return container;
  }

  function renderDetail(req) {
    let h = '<div class="detail-meta">';
    h += '<span><strong>' + req.method + '</strong> ' + escHtml(req.url) + '</span>';
    h += '<span>Status: ' + req.statusCode + '</span>';
    h += '<span>' + req.durationMs + 'ms</span>';
    if (req.responseSize) h += '<span>' + formatSize(req.responseSize) + '</span>';
    h += '</div>';
    h += '<div class="detail-grid">';
    h += '<div class="detail-section"><h4>Request Headers</h4><pre>' + formatHeaders(req.headers) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Headers</h4><pre>' + formatHeaders(req.responseHeaders) + '</pre></div>';
    h += '<div class="detail-section"><h4>Request Body</h4><pre>' + formatJsonBody(req.requestBody) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Body</h4><pre>' + formatJsonBody(req.responseBody) + '</pre></div>';
    h += '</div>';
    h += '<div class="detail-actions"><button class="btn btn-curl">Copy cURL</button></div>';
    return h;
  }

  // ===== ALL REQUESTS =====
  function renderRequests() {
    reqListEl.innerHTML = '';
    for (const req of state.requests) {
      if (req.path && req.path.startsWith('/__brakit')) continue;
      appendRequestRow(req);
    }
  }

  function prependRequestRow(req) {
    const {row, detail} = createReqRow(req);
    reqListEl.prepend(detail);
    reqListEl.prepend(row);
  }

  function appendRequestRow(req) {
    const {row, detail} = createReqRow(req);
    reqListEl.appendChild(row);
    reqListEl.appendChild(detail);
  }

  function createReqRow(req) {
    const row = document.createElement('div');
    row.className = 'req-row';
    const sClass = req.statusCode >= 500 ? 'status-5xx' : req.statusCode >= 400 ? 'status-4xx' : req.statusCode >= 300 ? 'status-3xx' : 'status-2xx';

    row.innerHTML =
      '<div class="req-summary">' +
        '<span class="req-method method-' + req.method + '">' + req.method + '</span>' +
        '<span class="req-url">' + escHtml(req.url) + '</span>' +
        '<span class="req-status ' + sClass + '">' + req.statusCode + '</span>' +
        '<span class="req-duration">' + req.durationMs + 'ms</span>' +
        '<span class="req-size">' + formatSize(req.responseSize) + '</span>' +
      '</div>';

    const detail = document.createElement('div');
    detail.className = 'req-detail';

    row.addEventListener('click', () => {
      const wasOpen = row.classList.contains('expanded');
      document.querySelectorAll('.req-row.expanded').forEach(r => r.classList.remove('expanded'));
      document.querySelectorAll('.req-detail.open').forEach(d => d.classList.remove('open'));
      if (!wasOpen) {
        row.classList.add('expanded');
        detail.classList.add('open');
        detail.innerHTML = renderDetail(req);
        const curlBtn = detail.querySelector('.btn-curl');
        if (curlBtn) curlBtn.addEventListener('click', (e) => { e.stopPropagation(); copyAsCurl(req); });
      }
    });

    return {row, detail};
  }

  // ===== SIDEBAR NAVIGATION =====
  const sidebarItems = document.querySelectorAll('.sidebar-item:not(.disabled)');
  sidebarItems.forEach(function(item) {
    item.addEventListener('click', function() {
      const view = item.getAttribute('data-view');
      if (!view || view === state.activeView) return;

      sidebarItems.forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
      state.activeView = view;

      const titles = { actions: 'Actions', requests: 'Requests' };
      document.getElementById('header-title').textContent = titles[view] || view;

      document.getElementById('mode-toggle').style.display = view === 'actions' ? 'flex' : 'none';

      if (view === 'requests') {
        appEl.classList.add('show-requests');
      } else {
        appEl.classList.remove('show-requests');
      }
    });
  });

  // ===== MODE TOGGLE =====
  document.getElementById('mode-simple').addEventListener('click', function() {
    state.viewMode = 'simple';
    document.getElementById('mode-simple').classList.add('active');
    document.getElementById('mode-detailed').classList.remove('active');
    document.querySelectorAll('.flow-row.expanded').forEach(function(r){ r.classList.remove('expanded'); });
    document.querySelectorAll('.flow-expand.open').forEach(function(d){ d.classList.remove('open'); });
  });
  document.getElementById('mode-detailed').addEventListener('click', function() {
    state.viewMode = 'detailed';
    document.getElementById('mode-detailed').classList.add('active');
    document.getElementById('mode-simple').classList.remove('active');
    document.querySelectorAll('.flow-row.expanded').forEach(function(r){ r.classList.remove('expanded'); });
    document.querySelectorAll('.flow-expand.open').forEach(function(d){ d.classList.remove('open'); });
  });

  // ===== STATS =====
  function updateStats() {
    const reqs = state.requests.filter(r => !r.path?.startsWith('/__brakit'));
    const errors = reqs.filter(r => r.statusCode >= 400).length;
    const avg = reqs.length > 0 ? Math.round(reqs.reduce((s,r) => s + r.durationMs, 0) / reqs.length) : 0;
    document.getElementById('stat-total').textContent = reqs.length + ' request' + (reqs.length !== 1 ? 's' : '');
    document.getElementById('stat-flows').textContent = state.flows.length + ' action' + (state.flows.length !== 1 ? 's' : '');
    document.getElementById('stat-errors').textContent = errors + ' error' + (errors !== 1 ? 's' : '');
    document.getElementById('stat-avg').textContent = 'Avg: ' + avg + 'ms';

    const actionCount = document.getElementById('sidebar-count-actions');
    const requestCount = document.getElementById('sidebar-count-requests');
    if (actionCount) actionCount.textContent = state.flows.length;
    if (requestCount) requestCount.textContent = reqs.length;
  }

  // ===== ACTIONS =====
  function copyAsCurl(req) {
    const headers = Object.entries(req.headers || {})
      .filter(([k]) => k !== 'host' && k !== 'connection' && k !== 'accept-encoding')
      .map(([k,v]) => "-H '" + k + ": " + v + "'")
      .join(' ');
    const body = req.requestBody ? " -d '" + req.requestBody.replace(/'/g, "'\\\\''") + "'" : '';
    const curl = "curl -X " + req.method + " " + headers + body + " 'http://localhost:" + PORT + req.url + "'";
    navigator.clipboard.writeText(curl).then(() => showToast('Copied cURL command'));
  }

  document.getElementById('clear-btn').addEventListener('click', async () => {
    await fetch('/__brakit/api/clear', {method: 'POST'});
    state.flows = []; state.requests = [];
    renderFlows(); renderRequests(); updateStats();
    showToast('Cleared');
  });

  // ===== HELPERS =====
  function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }
  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return bytes + 'b';
    return (bytes / 1024).toFixed(1) + 'kb';
  }
  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  const SENSITIVE = new Set(['cookie','set-cookie','authorization','proxy-authorization','x-api-key','x-auth-token']);
  function maskValue(k, v) {
    if (SENSITIVE.has(k.toLowerCase())) {
      const s = String(v);
      if (s.length <= 8) return '****';
      return s.slice(0, 4) + '...' + s.slice(-4) + ' (' + s.length + ' chars)';
    }
    return String(v);
  }
  function formatHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) return '<span style="color:var(--text-muted)">No headers</span>';
    return Object.entries(headers).map(([k,v]) => '<span class="json-key">' + escHtml(k) + '</span>: ' + escHtml(maskValue(k, v))).join('\\n');
  }
  function buildBodyToggle(direction, label, body) {
    var block = document.createElement('div');
    block.className = 'traffic-body';

    var toggle = document.createElement('button');
    toggle.className = 'traffic-body-toggle';
    toggle.innerHTML = '<span class="chevron">\\u25B8</span><span class="arrow-' + direction + '">' + (direction === 'out' ? '\\u2192' : '\\u2190') + '</span> ' + label;

    var pre = document.createElement('pre');
    pre.innerHTML = formatJsonBody(body);

    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = toggle.classList.contains('open');
      toggle.classList.toggle('open');
      pre.classList.toggle('open');
    });

    block.appendChild(toggle);
    block.appendChild(pre);
    return block;
  }
  function formatJsonBody(body) {
    if (!body) return '<span style="color:var(--text-muted)">No body</span>';
    try {
      const parsed = JSON.parse(body);
      return highlightJson(JSON.stringify(parsed, null, 2));
    } catch { return escHtml(body); }
  }
  function highlightJson(json) {
    return escHtml(json).replace(
      /("(?:[^"\\\\\\\\]|\\\\\\\\.)*")(\\\\s*:)?|\\\\b(true|false)\\\\b|\\\\bnull\\\\b|(-?\\\\d+\\\\.?\\\\d*(?:[eE][+-]?\\\\d+)?)/g,
      function(m, str, colon, bool, num) {
        if (str) return colon ? '<span class="json-key">' + str + '</span>' + colon : '<span class="json-str">' + str + '</span>';
        if (bool) return '<span class="json-bool">' + m + '</span>';
        if (num) return '<span class="json-num">' + m + '</span>';
        if (m === 'null') return '<span class="json-null">null</span>';
        return m;
      }
    );
  }
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2000);
  }

  init();
})();
`;
}
