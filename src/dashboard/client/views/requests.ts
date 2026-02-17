import { DASHBOARD_PREFIX } from "../../../constants.js";

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
    var sClass = req.statusCode >= 500 ? 'status-5xx' : req.statusCode >= 400 ? 'status-4xx' : req.statusCode >= 300 ? 'status-3xx' : 'status-2xx';
    row.innerHTML =
      '<div class="req-summary">' +
        '<span class="req-method method-' + req.method + '">' + req.method + '</span>' +
        '<span class="req-url">' + escHtml(req.url) + '</span>' +
        '<span class="req-status ' + sClass + '">' + req.statusCode + '</span>' +
        '<span class="req-duration">' + req.durationMs + 'ms</span>' +
        '<span class="req-size">' + formatSize(req.responseSize) + '</span>' +
      '</div>';
    var detail = document.createElement('div');
    detail.className = 'req-detail';
    row.addEventListener('click', function() {
      var wasOpen = row.classList.contains('expanded');
      document.querySelectorAll('.req-row.expanded').forEach(function(r) { r.classList.remove('expanded'); });
      document.querySelectorAll('.req-detail.open').forEach(function(d) { d.classList.remove('open'); });
      if (!wasOpen) {
        row.classList.add('expanded');
        detail.classList.add('open');
        detail.innerHTML = renderDetail(req);
        var curlBtn = detail.querySelector('.btn-curl');
        if (curlBtn) curlBtn.addEventListener('click', function(e) { e.stopPropagation(); copyAsCurl(req); });
      }
    });
    return { row: row, detail: detail };
  }
  `;
}
