import { DASHBOARD_API_METRICS_LIVE } from "../../../constants/index.js";
import { GRAPH_COLORS } from "../constants.js";
import { getGraphHealthUtils } from "./graph/health.js";
import { getGraphOverview } from "./graph/overview.js";
import { getGraphDetail } from "./graph/detail.js";
import { getGraphChart } from "./graph/chart.js";

export function getGraphView(): string {
  return `
  var graphData = null;
  var selectedEndpoint = '__all__';

  var GRAPH_COLORS = ${GRAPH_COLORS};

  ${getGraphHealthUtils()}
  ${getGraphOverview()}
  ${getGraphDetail()}
  ${getGraphChart()}

  function renderGraph() {
    var container = document.getElementById('graph-content');
    if (!container) return;
    container.innerHTML = '';

    if (!graphData || graphData.length === 0) {
      container.innerHTML = '<div class="empty" style="height:300px"><span class="empty-title">No performance data yet</span><span class="empty-sub">Hit some endpoints and data will appear here</span></div>';
      return;
    }

    var selector = document.createElement('div');
    selector.className = 'perf-selector';

    var allBtn = document.createElement('button');
    allBtn.className = 'perf-selector-btn' + (selectedEndpoint === '__all__' ? ' active' : '');
    allBtn.textContent = 'Overview';
    allBtn.addEventListener('click', function() { selectedEndpoint = '__all__'; renderGraph(); });
    selector.appendChild(allBtn);

    graphData.forEach(function(ep, idx) {
      var btn = document.createElement('button');
      var color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
      btn.className = 'perf-selector-btn' + (ep.endpoint === selectedEndpoint ? ' active' : '');
      btn.innerHTML = '<span class="perf-dot" style="background:' + color + '"></span>' + escHtml(ep.endpoint);
      btn.addEventListener('click', function() { selectedEndpoint = ep.endpoint; renderGraph(); });
      selector.appendChild(btn);
    });

    container.appendChild(selector);

    if (selectedEndpoint === '__all__') {
      renderPerfOverview(container);
    } else {
      renderEndpointDetail(container);
    }
  }

  async function loadMetrics() {
    try {
      var res = await fetch('${DASHBOARD_API_METRICS_LIVE}');
      var data = await res.json();
      graphData = data.endpoints || [];
      if (!selectedEndpoint || selectedEndpoint === '__all__') {
        selectedEndpoint = '__all__';
      }
      renderGraph();
    } catch(e) { console.warn('[brakit]', e); }
  }
  `;
}
