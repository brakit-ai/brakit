import {
  CLIENT_MAX_REQUESTS,
  CLIENT_RELOAD_DEBOUNCE_MS,
  DASHBOARD_PREFIX,
  DASHBOARD_API_FLOWS,
  DASHBOARD_API_REQUESTS,
  DASHBOARD_API_EVENTS,
  DASHBOARD_API_CLEAR,
  MAX_TELEMETRY_ENTRIES,
} from "../../constants/index.js";

export function getApp(): string {
  return `
  var VIEW_CONTAINERS = {
    overview: 'overview-container',
    actions: 'flow-container',
    requests: 'request-container',
    fetches: 'fetch-container',
    queries: 'query-container',
    errors: 'error-container',
    logs: 'log-container',
    performance: 'performance-container',
    security: 'security-container'
  };

  var VIEW_TITLES = {
    overview: 'Overview',
    actions: 'Actions',
    requests: 'Requests',
    fetches: 'Server Fetches',
    queries: 'Queries',
    errors: 'Errors',
    logs: 'Logs',
    performance: 'Performance',
    security: 'Security'
  };

  var VIEW_SUBTITLES = {
    overview: 'Live summary of your application',
    actions: 'User actions captured as sequences of HTTP requests',
    requests: 'All HTTP requests proxied through brakit',
    fetches: 'Outbound HTTP calls made by your server to external services',
    queries: 'Database queries executed during request handling',
    errors: 'Unhandled exceptions and errors thrown by your application',
    logs: 'Console output from your application',
    performance: 'Endpoint health and response time trends',
    security: 'Security findings and recommendations'
  };

  async function init() {
    try {
      var res = await fetch('${DASHBOARD_API_FLOWS}');
      var data = await res.json();
      state.flows = data.flows;
      renderFlows();
    } catch(e) { console.error('Failed to load flows', e); }

    try {
      var res2 = await fetch('${DASHBOARD_API_REQUESTS}');
      var data2 = await res2.json();
      state.requests = data2.requests;
      renderRequests();
    } catch(e) { console.warn('[brakit]', e); }

    await Promise.all([loadFetches(), loadErrors(), loadLogs(), loadQueries(), loadMetrics()]);

    updateStats();
    renderOverview();

    var events = new EventSource('${DASHBOARD_API_EVENTS}');
    var reloadTimer = null;
    var perfReloadTimer = null;
    events.onmessage = function(e) {
      var req = JSON.parse(e.data);
      if (req.path && req.path.startsWith('${DASHBOARD_PREFIX}')) return;
      state.requests.unshift(req);
      if (state.requests.length > ${CLIENT_MAX_REQUESTS}) state.requests.pop();
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reloadFlows, ${CLIENT_RELOAD_DEBOUNCE_MS});
      prependRequestRow(req);
      updateStats();
      if (state.activeView === 'performance') {
        clearTimeout(perfReloadTimer);
        perfReloadTimer = setTimeout(loadMetrics, 500);
      }
    };

    events.addEventListener('fetch', function(e) {
      var f = JSON.parse(e.data);
      state.fetches.unshift(f);
      if (state.fetches.length > ${MAX_TELEMETRY_ENTRIES}) state.fetches.pop();
      prependFetchRow(f);
      updateStats();
      if (f.parentRequestId) { invalidateTimelineCache(f.parentRequestId); refreshVisibleTimeline(f.parentRequestId); }
    });

    events.addEventListener('log', function(e) {
      var l = JSON.parse(e.data);
      state.logs.unshift(l);
      if (state.logs.length > ${MAX_TELEMETRY_ENTRIES}) state.logs.pop();
      prependLogRow(l);
      updateStats();
      if (l.parentRequestId) { invalidateTimelineCache(l.parentRequestId); refreshVisibleTimeline(l.parentRequestId); }
    });

    events.addEventListener('error_event', function(e) {
      var err = JSON.parse(e.data);
      state.errors.unshift(err);
      if (state.errors.length > ${MAX_TELEMETRY_ENTRIES}) state.errors.pop();
      prependErrorRow(err);
      updateStats();
      if (err.parentRequestId) { invalidateTimelineCache(err.parentRequestId); refreshVisibleTimeline(err.parentRequestId); }
    });

    events.addEventListener('query', function(e) {
      var q = JSON.parse(e.data);
      state.queries.unshift(q);
      if (state.queries.length > ${MAX_TELEMETRY_ENTRIES}) state.queries.pop();
      prependQueryRow(q);
      updateStats();
      if (q.parentRequestId) { invalidateTimelineCache(q.parentRequestId); refreshVisibleTimeline(q.parentRequestId); }
    });
  }

  async function reloadFlows() {
    try {
      var res = await fetch('${DASHBOARD_API_FLOWS}');
      var data = await res.json();
      state.flows = data.flows;
      renderFlows();
      updateStats();
      renderOverview();
    } catch(e) { console.warn('[brakit]', e); }
  }

  function switchView(view) {
    Object.keys(VIEW_CONTAINERS).forEach(function(v) {
      var el = document.getElementById(VIEW_CONTAINERS[v]);
      if (el) el.style.display = v === view ? 'block' : 'none';
    });
  }

  var sidebarItems = document.querySelectorAll('.sidebar-item:not(.disabled)');
  sidebarItems.forEach(function(item) {
    item.addEventListener('click', function() {
      var view = item.getAttribute('data-view');
      if (!view || view === state.activeView) return;
      sidebarItems.forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
      state.activeView = view;
      document.getElementById('header-title').textContent = VIEW_TITLES[view] || view;
      document.getElementById('header-sub').textContent = VIEW_SUBTITLES[view] || '';
      document.getElementById('mode-toggle').style.display = view === 'actions' ? 'flex' : 'none';
      if (view === 'overview') renderOverview();
      if (view === 'security') renderSecurity();
      if (view === 'performance') loadMetrics();
      switchView(view);
    });
  });

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

  function updateStats() {
    var reqs = state.requests.filter(function(r) { return !r.path || !r.path.startsWith('${DASHBOARD_PREFIX}'); });
    var errors = reqs.filter(function(r) { return r.statusCode >= 400; }).length;
    var avg = reqs.length > 0 ? Math.round(reqs.reduce(function(s,r) { return s + r.durationMs; }, 0) / reqs.length) : 0;
    document.getElementById('stat-total').textContent = reqs.length + ' request' + (reqs.length !== 1 ? 's' : '');
    document.getElementById('stat-flows').textContent = state.flows.length + ' action' + (state.flows.length !== 1 ? 's' : '');
    document.getElementById('stat-errors').textContent = errors + ' error' + (errors !== 1 ? 's' : '');
    document.getElementById('stat-avg').textContent = 'Avg: ' + avg + 'ms';
    var actionCount = document.getElementById('sidebar-count-actions');
    var requestCount = document.getElementById('sidebar-count-requests');
    var fetchCount = document.getElementById('sidebar-count-fetches');
    var errorCount = document.getElementById('sidebar-count-errors');
    var logCount = document.getElementById('sidebar-count-logs');
    var queryCount = document.getElementById('sidebar-count-queries');
    if (actionCount) actionCount.textContent = state.flows.length;
    if (requestCount) requestCount.textContent = reqs.length;
    if (fetchCount) fetchCount.textContent = state.fetches.length;
    if (errorCount) errorCount.textContent = state.errors.length;
    if (logCount) logCount.textContent = state.logs.length;
    if (queryCount) queryCount.textContent = state.queries.length;
    var secCount = document.getElementById('sidebar-count-security');
    if (secCount) {
      var secFindings = computeSecurityFindings();
      secCount.textContent = secFindings.length;
      secCount.style.display = secFindings.length > 0 ? '' : 'none';
    }
  }

  function copyAsCurl(req) {
    var headers = Object.entries(req.headers || {})
      .filter(function(e) { return e[0] !== 'host' && e[0] !== 'connection' && e[0] !== 'accept-encoding'; })
      .map(function(e) { return "-H '" + e[0] + ": " + e[1] + "'"; })
      .join(' ');
    var body = req.requestBody ? " -d '" + req.requestBody.replace(/'/g, "'\\\\''") + "'" : '';
    var curl = "curl -X " + req.method + " " + headers + body + " 'http://localhost:" + PORT + req.url + "'";
    navigator.clipboard.writeText(curl).then(function() { showToast('Copied cURL command'); });
  }

  document.getElementById('clear-btn').addEventListener('click', async function() {
    if (!confirm('This will clear all data including performance metrics history. Continue?')) return;
    await fetch('${DASHBOARD_API_CLEAR}', {method: 'POST'});
    state.flows = []; state.requests = []; state.fetches = []; state.errors = []; state.logs = []; state.queries = [];
    graphData = []; selectedEndpoint = '__all__'; timelineCache = {};
    renderFlows(); renderRequests(); renderFetches(); renderErrors(); renderLogs(); renderQueries(); renderGraph(); renderOverview(); renderSecurity(); updateStats();
    showToast('Cleared');
  });

  init();
  `;
}
