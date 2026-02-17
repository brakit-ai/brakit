import {
  CLIENT_MAX_REQUESTS,
  CLIENT_RELOAD_DEBOUNCE_MS,
  DASHBOARD_PREFIX,
  DASHBOARD_API_FLOWS,
  DASHBOARD_API_REQUESTS,
  DASHBOARD_API_EVENTS,
  DASHBOARD_API_CLEAR,
} from "../../constants.js";

export function getApp(): string {
  return `
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
    } catch(e) {}

    updateStats();

    var events = new EventSource('${DASHBOARD_API_EVENTS}');
    var reloadTimer = null;
    events.onmessage = function(e) {
      var req = JSON.parse(e.data);
      if (req.path && req.path.startsWith('${DASHBOARD_PREFIX}')) return;
      state.requests.unshift(req);
      if (state.requests.length > ${CLIENT_MAX_REQUESTS}) state.requests.pop();
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(reloadFlows, ${CLIENT_RELOAD_DEBOUNCE_MS});
      prependRequestRow(req);
      updateStats();
    };
  }

  async function reloadFlows() {
    try {
      var res = await fetch('${DASHBOARD_API_FLOWS}');
      var data = await res.json();
      state.flows = data.flows;
      renderFlows();
      updateStats();
    } catch(e) {}
  }

  var sidebarItems = document.querySelectorAll('.sidebar-item:not(.disabled)');
  sidebarItems.forEach(function(item) {
    item.addEventListener('click', function() {
      var view = item.getAttribute('data-view');
      if (!view || view === state.activeView) return;
      sidebarItems.forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
      state.activeView = view;
      var titles = { actions: 'Actions', requests: 'Requests' };
      document.getElementById('header-title').textContent = titles[view] || view;
      document.getElementById('mode-toggle').style.display = view === 'actions' ? 'flex' : 'none';
      if (view === 'requests') {
        appEl.classList.add('show-requests');
      } else {
        appEl.classList.remove('show-requests');
      }
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
    if (actionCount) actionCount.textContent = state.flows.length;
    if (requestCount) requestCount.textContent = reqs.length;
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
    await fetch('${DASHBOARD_API_CLEAR}', {method: 'POST'});
    state.flows = []; state.requests = [];
    renderFlows(); renderRequests(); updateStats();
    showToast('Cleared');
  });

  init();
  `;
}
