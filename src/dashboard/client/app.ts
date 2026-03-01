import {
  DASHBOARD_PREFIX,
  DASHBOARD_API_FLOWS,
  DASHBOARD_API_REQUESTS,
  DASHBOARD_API_EVENTS,
  DASHBOARD_API_CLEAR,
  DASHBOARD_API_INSIGHTS,
  DASHBOARD_API_SECURITY,
  DASHBOARD_API_TAB,
  MAX_TELEMETRY_ENTRIES,
} from "../../constants/index.js";
import {
  CLIENT_MAX_REQUESTS,
  CLIENT_RELOAD_DEBOUNCE_MS,
  VIEW_CONTAINERS,
  VIEW_TITLES,
  VIEW_SUBTITLES,
  ALL_ENDPOINTS_SELECTOR,
  PERF_RELOAD_DEBOUNCE_MS,
  CURL_SKIP_HEADERS,
} from "./constants/index.js";

export function getApp(): string {
  return `
  var VIEW_CONTAINERS = ${VIEW_CONTAINERS};
  var VIEW_TITLES = ${VIEW_TITLES};
  var VIEW_SUBTITLES = ${VIEW_SUBTITLES};

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

    try {
      var res3 = await fetch('${DASHBOARD_API_INSIGHTS}');
      var data3 = await res3.json();
      state.insights = data3.insights || [];
    } catch(e) { console.warn('[brakit]', e); }

    try {
      var res4 = await fetch('${DASHBOARD_API_SECURITY}');
      var data4 = await res4.json();
      state.findings = data4.findings || [];
    } catch(e) { console.warn('[brakit]', e); }

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
        perfReloadTimer = setTimeout(loadMetrics, ${PERF_RELOAD_DEBOUNCE_MS});
      }
    };

    function registerTelemetryListener(eventName, stateKey, prependFn) {
      events.addEventListener(eventName, function(e) {
        var item = JSON.parse(e.data);
        state[stateKey].unshift(item);
        if (state[stateKey].length > ${MAX_TELEMETRY_ENTRIES}) state[stateKey].pop();
        prependFn(item);
        updateStats();
        if (item.parentRequestId) { invalidateTimelineCache(item.parentRequestId); refreshVisibleTimeline(item.parentRequestId); }
      });
    }
    registerTelemetryListener('fetch', 'fetches', prependFetchRow);
    registerTelemetryListener('log', 'logs', prependLogRow);
    registerTelemetryListener('error_event', 'errors', prependErrorRow);
    registerTelemetryListener('query', 'queries', prependQueryRow);

    events.addEventListener('insights', function(e) {
      state.insights = JSON.parse(e.data);
      if (state.activeView === 'overview') renderOverview();
      updateStats();
    });

    events.addEventListener('security', function(e) {
      state.findings = JSON.parse(e.data);
      if (state.activeView === 'security') renderSecurity();
      updateStats();
    });

    window.addEventListener('beforeunload', function() {
      events.close();
      clearTimeout(reloadTimer);
      clearTimeout(perfReloadTimer);
    });
  }

  async function reloadFlows() {
    try {
      var res = await fetch('${DASHBOARD_API_FLOWS}');
      var data = await res.json();
      state.flows = data.flows;
      renderFlows();
      updateStats();
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
      fetch('${DASHBOARD_API_TAB}?tab=' + encodeURIComponent(view)).catch(function(){});
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
    collapseAll('.flow-row', '.flow-expand');
  });
  document.getElementById('mode-detailed').addEventListener('click', function() {
    state.viewMode = 'detailed';
    document.getElementById('mode-detailed').classList.add('active');
    document.getElementById('mode-simple').classList.remove('active');
    collapseAll('.flow-row', '.flow-expand');
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
      var numFindings = (state.findings || []).filter(function(f) { return f.state !== 'resolved'; }).length;
      secCount.textContent = numFindings;
      secCount.style.display = numFindings > 0 ? '' : 'none';
    }
  }

  function copyAsCurl(req) {
    var headers = Object.entries(req.headers || {})
      .filter(function(e) { return ${CURL_SKIP_HEADERS}.indexOf(e[0]) === -1; })
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
    state.insights = []; state.findings = [];
    graphData = []; selectedEndpoint = ${ALL_ENDPOINTS_SELECTOR}; timelineCache = {};
    renderFlows(); renderRequests(); renderFetches(); renderErrors(); renderLogs(); renderQueries(); renderGraph(); renderOverview(); renderSecurity(); updateStats();
    showToast('Cleared');
  });

  init();
  `;
}
