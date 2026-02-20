import { DASHBOARD_PREFIX } from "../../../constants/index.js";

export function getRequestsView(): string {
  return `
  function renderRequests() {
    reqListEl.innerHTML = '';
    for (var i = 0; i < state.requests.length; i++) {
      var req = state.requests[i];
      if (req.path && req.path.startsWith('${DASHBOARD_PREFIX}')) continue;
      appendRequestRow(req);
    }
  }

  function prependRequestRow(req) {
    var result = createReqRow(req);
    reqListEl.prepend(result.detail);
    reqListEl.prepend(result.row);
  }

  function appendRequestRow(req) {
    var result = createReqRow(req);
    reqListEl.appendChild(result.row);
    reqListEl.appendChild(result.detail);
  }

  function createReqRow(req) {
    var row = document.createElement('div');
    row.className = 'req-row';
    var sClass = statusPillClass(req.statusCode);
    row.innerHTML =
      '<div class="req-summary">' +
        '<span class="method-badge method-badge-' + req.method + '">' + req.method + '</span>' +
        '<span class="req-url">' + escHtml(req.url) + '</span>' +
        '<span class="status-pill ' + sClass + '">' + req.statusCode + '</span>' +
        '<span class="req-duration">' + req.durationMs + 'ms</span>' +
        '<span class="req-size">' + formatSize(req.responseSize) + '</span>' +
      '</div>';
    var detail = document.createElement('div');
    detail.className = 'req-detail';
    row.addEventListener('click', function() {
      var wasOpen = row.classList.contains('expanded');
      collapseAll('.req-row', '.req-detail');
      if (!wasOpen) {
        row.classList.add('expanded');
        detail.classList.add('open');
        detail.innerHTML = renderDetail(req);
        var curlBtn = detail.querySelector('.btn-curl');
        if (curlBtn) curlBtn.addEventListener('click', function(e) { e.stopPropagation(); copyAsCurl(req); });
        var tlEl = detail.querySelector('.request-timeline');
        if (tlEl) loadTimeline(tlEl.getAttribute('data-request-id'), tlEl, 0);
      }
    });
    return { row: row, detail: detail };
  }
  `;
}
