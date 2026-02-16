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
  function renderFlows() {
    flowListEl.innerHTML = '';
    if (state.flows.length === 0) {
      flowListEl.appendChild(emptyFlows);
      emptyFlows.style.display = 'flex';
      return;
    }
    emptyFlows.style.display = 'none';
    for (const flow of state.flows) {
      if (state.viewMode === 'simple') {
        flowListEl.appendChild(createSimpleFlowCard(flow));
      } else {
        flowListEl.appendChild(createDetailedFlowCard(flow));
      }
    }
  }

  function createFlowHeader(flow) {
    const header = document.createElement('div');
    header.className = 'flow-header';

    const icon = document.createElement('span');
    icon.className = 'flow-icon';
    icon.textContent = getFlowIcon(flow);

    const label = document.createElement('span');
    label.className = 'flow-label';
    label.textContent = flow.label;

    const dur = document.createElement('span');
    dur.className = 'flow-duration';
    dur.textContent = formatDuration(flow.totalDurationMs);

    const badge = document.createElement('span');
    badge.className = 'badge';
    if (flow.hasErrors) {
      badge.className += ' badge-error';
      badge.textContent = 'Error';
    } else if (flow.redundancyPct > 0) {
      badge.className += ' badge-warn';
      badge.textContent = flow.redundancyPct + '% redundant';
    } else {
      badge.className += ' badge-clean';
      badge.textContent = '\\u2713 Clean';
    }

    header.appendChild(icon);
    header.appendChild(label);
    header.appendChild(badge);
    header.appendChild(dur);
    return header;
  }

  function getFlowIcon(flow) {
    if (flow.hasErrors) return '\\u26A0';
    const l = flow.label.toLowerCase();
    if (l.includes('page')) return '\\uD83D\\uDCC4';
    if (l.includes('creat') || l.includes('generat') || l.includes('submit')) return '\\u26A1';
    if (l.includes('delet') || l.includes('remov')) return '\\uD83D\\uDDD1';
    if (l.includes('updat') || l.includes('edit') || l.includes('save')) return '\\u270F';
    return '\\uD83D\\uDD0D';
  }

  function flowCardClass(flow) {
    if (flow.hasErrors) return 'flow-card has-errors';
    if (flow.redundancyPct > 0) return 'flow-card has-redundancy';
    return 'flow-card is-clean';
  }

  // ===== SIMPLE =====
  function createSimpleFlowCard(flow) {
    const card = document.createElement('div');
    card.className = flowCardClass(flow);
    card.appendChild(createFlowHeader(flow));

    const body = document.createElement('div');
    body.className = 'simple-body';
    const insights = analyzeFlow(flow);

    if (insights.successes.length > 0) {
      const el = document.createElement('div');
      el.className = 'simple-success';
      el.innerHTML = '\\u2713 <span>' + escHtml(insights.successes.join(', ')) + '</span>';
      body.appendChild(el);
    }

    if (insights.errors.length > 0) {
      const el = document.createElement('div');
      el.className = 'simple-errors';
      for (const err of insights.errors) {
        const item = document.createElement('div');
        item.className = 'simple-error-item';
        item.textContent = '\\u2717 ' + err;
        el.appendChild(item);
      }
      body.appendChild(el);
    }

    if (insights.duplicates.length > 0) {
      const el = document.createElement('div');
      el.className = 'simple-problems';
      for (const dup of insights.duplicates) {
        const item = document.createElement('div');
        item.className = 'simple-problem';
        item.innerHTML = '\\u26A0 <span class="simple-problem-label">' + escHtml(dup.name) +
          '</span> \\u2014 loaded ' + dup.count + ' times ' +
          '<span class="simple-problem-waste">(wasting ~' + formatDuration(dup.wastedMs) + ')</span>';
        el.appendChild(item);
      }
      body.appendChild(el);
    }

    if (insights.tip) {
      const tip = document.createElement('div');
      tip.className = 'simple-tip';
      tip.innerHTML = '<strong>Tip:</strong> ' + escHtml(insights.tip);
      body.appendChild(tip);
    }

    if (insights.errors.length === 0 && insights.duplicates.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'simple-ok';
      ok.textContent = '\\u2713 Everything looks good!';
      body.appendChild(ok);
    }

    card.appendChild(body);
    return card;
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
  function createDetailedFlowCard(flow) {
    const card = document.createElement('div');
    card.className = flowCardClass(flow);
    card.appendChild(createFlowHeader(flow));

    const reqList = document.createElement('div');
    reqList.className = 'flow-requests';

    flow.requests.forEach((req) => {
      const st = statusIcon(req.statusCode);
      const isDup = req.isDuplicate;

      const row = document.createElement('div');
      row.className = 'flow-req';

      const labelEl = document.createElement('span');
      labelEl.className = 'flow-req-label' + (isDup ? ' is-dup' : '');
      labelEl.textContent = req.label;

      const dots = document.createElement('span');
      dots.className = 'flow-req-dots';

      const durEl = document.createElement('span');
      durEl.className = 'flow-req-dur';
      durEl.textContent = req.pollingDurationMs ? formatDuration(req.pollingDurationMs) : formatDuration(req.durationMs);

      const statusEl = document.createElement('span');
      statusEl.className = 'flow-req-status tooltip ' + st.cls;
      statusEl.textContent = st.icon;
      statusEl.setAttribute('data-tip', st.tip);

      row.appendChild(labelEl);
      row.appendChild(dots);
      row.appendChild(durEl);
      row.appendChild(statusEl);

      if (isDup) {
        const dupEl = document.createElement('span');
        dupEl.className = 'dup-badge';
        dupEl.textContent = 'duplicate';
        row.appendChild(dupEl);
      }

      const detail = document.createElement('div');
      detail.className = 'flow-req-detail';

      row.addEventListener('click', () => {
        const wasOpen = detail.classList.contains('open');
        card.querySelectorAll('.flow-req-detail.open').forEach(d => d.classList.remove('open'));
        card.querySelectorAll('.flow-req.expanded').forEach(r => r.classList.remove('expanded'));
        if (!wasOpen) {
          row.classList.add('expanded');
          detail.classList.add('open');
          detail.innerHTML = renderDetail(req);
          const curlBtn = detail.querySelector('.btn-curl');
          if (curlBtn) curlBtn.addEventListener('click', (e) => { e.stopPropagation(); copyAsCurl(req); });
        }
      });

      reqList.appendChild(row);
      reqList.appendChild(detail);
    });
    card.appendChild(reqList);

    const summary = document.createElement('div');
    summary.className = 'flow-summary';
    if (flow.warnings.length > 0) {
      summary.className += ' summary-warn';
      summary.innerHTML = '\\u26A0 ' + escHtml(flow.warnings[0]);
      if (flow.warnings.length > 1) summary.innerHTML += ' <span style="color:var(--text-muted)">(+' + (flow.warnings.length - 1) + ' more)</span>';
    } else {
      summary.className += ' summary-ok';
      summary.textContent = '\\u2713 No issues';
    }
    card.appendChild(summary);
    return card;
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
  document.getElementById('mode-simple').addEventListener('click', () => {
    state.viewMode = 'simple';
    document.getElementById('mode-simple').classList.add('active');
    document.getElementById('mode-detailed').classList.remove('active');
    renderFlows();
  });
  document.getElementById('mode-detailed').addEventListener('click', () => {
    state.viewMode = 'detailed';
    document.getElementById('mode-detailed').classList.add('active');
    document.getElementById('mode-simple').classList.remove('active');
    renderFlows();
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
