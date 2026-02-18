import { DASHBOARD_PREFIX } from "../../../../constants.js";

export function getOverviewRender(): string {
  return `
  function renderOverview() {
    var container = document.getElementById('overview-content');
    if (!container) return;
    container.innerHTML = '';

    var nonStatic = state.requests.filter(function(r) {
      return !r.isStatic && (!r.path || r.path.indexOf('${DASHBOARD_PREFIX}') !== 0);
    });

    var hasData = nonStatic.length > 0 || state.queries.length > 0 || state.errors.length > 0;

    if (!hasData) {
      container.innerHTML = '<div class="empty" style="height:400px"><span class="empty-title">Waiting for requests...</span><span class="empty-sub">Start using your app to see insights here</span></div>';
      return;
    }

    var errCount = nonStatic.filter(function(r) { return r.statusCode >= 400; }).length;
    var avgMs = nonStatic.length > 0 ? Math.round(nonStatic.reduce(function(s, r) { return s + r.durationMs; }, 0) / nonStatic.length) : 0;

    var summary = document.createElement('div');
    summary.className = 'ov-summary';
    summary.innerHTML =
      '<div class="ov-stat"><span class="ov-stat-value">' + nonStatic.length + '</span><span class="ov-stat-label">Requests</span></div>' +
      '<div class="ov-stat"><span class="ov-stat-value">' + state.flows.length + '</span><span class="ov-stat-label">Actions</span></div>' +
      '<div class="ov-stat"><span class="ov-stat-value">' + formatDuration(avgMs) + '</span><span class="ov-stat-label">Avg Response</span></div>' +
      '<div class="ov-stat"><span class="ov-stat-value">' + state.queries.length + '</span><span class="ov-stat-label">Queries</span></div>' +
      (errCount > 0
        ? '<div class="ov-stat"><span class="ov-stat-value" style="color:var(--red)">' + errCount + '</span><span class="ov-stat-label">Errors</span></div>'
        : '<div class="ov-stat"><span class="ov-stat-value" style="color:var(--green)">' + errCount + '</span><span class="ov-stat-label">Errors</span></div>') +
      '<div class="ov-stat"><span class="ov-stat-value">' + state.fetches.length + '</span><span class="ov-stat-label">Fetches</span></div>';
    container.appendChild(summary);

    var insights = computeInsights();

    if (insights.length === 0) {
      var clear = document.createElement('div');
      clear.className = 'ov-clear';
      clear.innerHTML = '<span class="ov-clear-icon">\\u2713</span>All clear — no issues detected';
      container.appendChild(clear);
      return;
    }

    var title = document.createElement('div');
    title.className = 'ov-section-title';
    title.innerHTML = 'Issues Found <span class="ov-issue-count">' + insights.length + '</span>';
    container.appendChild(title);

    var cards = document.createElement('div');
    cards.className = 'ov-cards';

    for (var i = 0; i < insights.length; i++) {
      (function(insight) {
        var card = document.createElement('div');
        card.className = 'ov-card';

        var iconCls = insight.severity === 'critical' ? 'critical' : insight.severity === 'info' ? 'info' : 'warning';
        var iconChar = insight.severity === 'critical' ? '\\u2717' : insight.severity === 'info' ? '\\u2139' : '\\u26A0';

        card.innerHTML =
          '<span class="ov-card-icon ' + iconCls + '">' + iconChar + '</span>' +
          '<div class="ov-card-body">' +
            '<div class="ov-card-title">' + escHtml(insight.title) + '</div>' +
            '<div class="ov-card-desc">' + insight.desc + '</div>' +
          '</div>' +
          '<span class="ov-card-arrow">\\u2192</span>';

        card.addEventListener('click', function() {
          var navView = insight.nav;
          var sidebarItem = document.querySelector('.sidebar-item[data-view="' + navView + '"]');
          if (sidebarItem) sidebarItem.click();
        });

        cards.appendChild(card);
      })(insights[i]);
    }

    container.appendChild(cards);
  }
  `;
}
