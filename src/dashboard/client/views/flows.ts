import { getFlowInsights } from "./flows/insights.js";
import { getFlowDetail } from "./flows/detail.js";

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

  function flowBadgeInfo(flow) {
    if (flow.hasErrors) {
      var errCount = flow.requests.filter(function(r){ return r.statusCode >= 400; }).length;
      return { text: errCount + ' error' + (errCount !== 1 ? 's' : ''), cls: 'badge-error' };
    }
    if (flow.redundancyPct > 0) {
      return { text: flow.redundancyPct + '% redundant', cls: 'badge-warn' };
    }
    return { text: 'clean', cls: 'badge-clean' };
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
    var badgeInfo = flowBadgeInfo(flow);
    var badge = document.createElement('span');
    badge.className = 'flow-badge-pill ' + badgeInfo.cls;
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
        var tlEls = expand.querySelectorAll('.request-timeline');
        for (var ti = 0; ti < tlEls.length; ti++) {
          var tlItem = tlEls[ti];
          var rid = tlItem.getAttribute('data-request-id');
          if (rid) loadTimeline(rid, tlItem, 0);
        }
      }
    });

    return { row: row, expand: expand };
  }

  ${getFlowInsights()}
  ${getFlowDetail()}
  `;
}
