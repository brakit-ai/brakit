import { DASHBOARD_PREFIX } from "../../../../constants/index.js";
import { NAV_LABELS, SEVERITY_MAP } from "../../constants/index.js";

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

    var all = state.insights || [];
    var open = all.filter(function(si) { return si.state === 'open'; });
    var resolved = all.filter(function(si) { return si.state === 'resolved'; });

    if (open.length === 0 && resolved.length === 0) {
      var clear = document.createElement('div');
      clear.className = 'ov-clear';
      clear.innerHTML = '<span class="ov-clear-icon">\\u2713</span>All clear — no issues detected';
      container.appendChild(clear);
      return;
    }

    if (open.length === 0 && resolved.length > 0) {
      var allFixed = document.createElement('div');
      allFixed.className = 'ov-clear';
      allFixed.innerHTML = '<span class="ov-clear-icon">\\u2713</span>All issues resolved — ' + resolved.length + ' finding' + (resolved.length !== 1 ? 's were' : ' was') + ' detected and fixed';
      container.appendChild(allFixed);
    }

    var NAV_LABELS = ${NAV_LABELS};
    var SEV = ${SEVERITY_MAP};

    if (open.length > 0) {
      var title = document.createElement('div');
      title.className = 'ov-section-title';
      title.innerHTML = 'Issues Found <span class="ov-issue-count">' + open.length + '</span>';
      container.appendChild(title);

      var cards = document.createElement('div');
      cards.className = 'ov-cards';

      for (var i = 0; i < open.length; i++) {
        (function(si) {
          var insight = si.insight;
          var card = document.createElement('div');
          card.className = 'ov-card';

          var sevCfg = SEV[insight.severity];
          var iconCls = sevCfg.cls;
          var iconChar = sevCfg.icon;

          var expandHtml = '';
          if (insight.detail) expandHtml += insight.detail;
          if (insight.hint) expandHtml += '<div class="ov-card-hint">' + escHtml(insight.hint) + '</div>';
          expandHtml += '<span class="ov-card-link" data-nav="' + insight.nav + '">View in ' + (NAV_LABELS[insight.nav] || insight.nav) + ' \\u2192</span>';

          card.innerHTML =
            '<span class="ov-card-icon ' + iconCls + '">' + iconChar + '</span>' +
            '<div class="ov-card-body">' +
              '<div class="ov-card-title">' + escHtml(insight.title) + '</div>' +
              '<div class="ov-card-desc">' + insight.desc + '</div>' +
              '<div class="ov-card-expand">' + expandHtml + '</div>' +
            '</div>' +
            '<span class="ov-card-arrow">\\u2192</span>';

          card.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target !== card) {
              if (target.classList && target.classList.contains('ov-card-link')) {
                var navView = target.getAttribute('data-nav');
                var sidebarItem = document.querySelector('.sidebar-item[data-view="' + navView + '"]');
                if (sidebarItem) sidebarItem.click();
                return;
              }
              target = target.parentElement;
            }
            var expand = card.querySelector('.ov-card-expand');
            var arrow = card.querySelector('.ov-card-arrow');
            if (card.classList.contains('expanded')) {
              card.classList.remove('expanded');
              expand.style.display = 'none';
              arrow.textContent = '\\u2192';
            } else {
              card.classList.add('expanded');
              expand.style.display = 'block';
              arrow.textContent = '\\u2193';
            }
          });

          cards.appendChild(card);
        })(open[i]);
      }

      container.appendChild(cards);
    }

    if (resolved.length > 0) {
      var resolvedTitle = document.createElement('div');
      resolvedTitle.className = 'ov-section-title ov-resolved-title';
      resolvedTitle.innerHTML = '<span style="color:var(--green)">\\u2713</span> Resolved <span class="ov-issue-count">' + resolved.length + '</span>';
      container.appendChild(resolvedTitle);

      var resolvedCards = document.createElement('div');
      resolvedCards.className = 'ov-cards';

      for (var ri = 0; ri < resolved.length; ri++) {
        var rInsight = resolved[ri].insight;
        var rCard = document.createElement('div');
        rCard.className = 'ov-card ov-card-resolved';
        rCard.innerHTML =
          '<span class="ov-card-icon resolved">\\u2713</span>' +
          '<div class="ov-card-body">' +
            '<div class="ov-card-title" style="text-decoration:line-through;color:var(--text-muted)">' + escHtml(rInsight.title) + '</div>' +
            '<div class="ov-card-desc">' + rInsight.desc + '</div>' +
          '</div>';
        resolvedCards.appendChild(rCard);
      }

      container.appendChild(resolvedCards);
    }
  }
  `;
}
