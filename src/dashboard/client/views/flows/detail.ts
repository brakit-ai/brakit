import {
  DASHBOARD_API_FETCHES,
  DASHBOARD_API_LOGS,
  DASHBOARD_API_ERRORS,
  DASHBOARD_API_QUERIES,
} from "../../../../constants.js";
import { SLOW_QUERY_THRESHOLD_MS } from "../../constants.js";

export function getFlowDetail(): string {
  return `
  function createFlowSubReqs(flow) {
    var container = document.createElement('div');
    container.className = 'flow-subreqs';
    flow.requests.forEach(function(req) {
      var isDup = req.isDuplicate;
      var sClass = req.statusCode >= 500 ? 'status-5xx' : req.statusCode >= 400 ? 'status-4xx' : req.statusCode >= 300 ? 'status-3xx' : 'status-2xx';
      var subRow = document.createElement('div');
      subRow.className = 'flow-subreq';
      var methodEl = document.createElement('span');
      methodEl.className = 'subreq-method method-' + req.method;
      methodEl.textContent = req.method;
      var labelEl = document.createElement('span');
      labelEl.className = 'subreq-label' + (isDup ? ' is-dup' : '');
      labelEl.textContent = req.path || req.url;
      var statusEl = document.createElement('span');
      statusEl.className = 'subreq-status ' + sClass;
      statusEl.textContent = String(req.statusCode);
      var durEl = document.createElement('span');
      durEl.className = 'subreq-dur';
      durEl.textContent = req.pollingDurationMs ? formatDuration(req.pollingDurationMs) : formatDuration(req.durationMs);
      subRow.appendChild(methodEl);
      subRow.appendChild(labelEl);
      if (isDup) {
        var dupTag = document.createElement('span');
        dupTag.className = 'subreq-dup-tag';
        dupTag.textContent = 'dup';
        subRow.appendChild(dupTag);
      }
      subRow.appendChild(statusEl);
      subRow.appendChild(durEl);

      var detail = document.createElement('div');
      detail.className = 'flow-subreq-detail';
      subRow.addEventListener('click', function(e) {
        e.stopPropagation();
        var wasOpen = detail.classList.contains('open');
        container.querySelectorAll('.flow-subreq-detail.open').forEach(function(d){ d.classList.remove('open'); });
        container.querySelectorAll('.flow-subreq.expanded').forEach(function(r){ r.classList.remove('expanded'); });
        if (!wasOpen) {
          subRow.classList.add('expanded');
          detail.classList.add('open');
          detail.innerHTML = renderDetail(req);
          var curlBtn = detail.querySelector('.btn-curl');
          if (curlBtn) curlBtn.addEventListener('click', function(ev) { ev.stopPropagation(); copyAsCurl(req); });
          var saEl = detail.querySelector('.server-activity');
          if (saEl) loadServerActivity(saEl);
        }
      });
      container.appendChild(subRow);
      container.appendChild(detail);
    });
    return container;
  }

  function renderDetail(req) {
    var h = '<div class="detail-meta">';
    h += '<span><strong>' + req.method + '</strong> ' + escHtml(req.url) + '</span>';
    h += '<span>Status: ' + req.statusCode + '</span>';
    h += '<span>' + req.durationMs + 'ms</span>';
    if (req.responseSize) h += '<span>' + formatSize(req.responseSize) + '</span>';
    h += '</div>';
    h += '<div class="server-activity" data-request-id="' + req.id + '"><div class="server-activity-loading" style="color:var(--dim);padding:8px 0;font-size:12px">Loading server activity...</div></div>';
    h += '<div class="detail-grid">';
    h += '<div class="detail-section"><h4>Request Headers</h4><pre>' + formatHeaders(req.headers) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Headers</h4><pre>' + formatHeaders(req.responseHeaders) + '</pre></div>';
    h += '<div class="detail-section"><h4>Request Body</h4><pre>' + formatJsonBody(req.requestBody) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Body</h4><pre>' + formatJsonBody(req.responseBody) + '</pre></div>';
    h += '</div>';
    h += '<div class="detail-actions"><button class="btn btn-curl">Copy cURL</button></div>';
    return h;
  }

  async function loadServerActivity(container) {
    var rid = container.getAttribute('data-request-id');
    if (!rid) return;
    try {
      var results = await Promise.all([
        fetch('${DASHBOARD_API_FETCHES}?requestId=' + rid).then(function(r) { return r.json(); }),
        fetch('${DASHBOARD_API_LOGS}?requestId=' + rid).then(function(r) { return r.json(); }),
        fetch('${DASHBOARD_API_ERRORS}?requestId=' + rid).then(function(r) { return r.json(); }),
        fetch('${DASHBOARD_API_QUERIES}?requestId=' + rid).then(function(r) { return r.json(); })
      ]);
      var fetches = results[0].entries || [];
      var logs = results[1].entries || [];
      var errors = results[2].entries || [];
      var queries = results[3].entries || [];
      if (fetches.length === 0 && logs.length === 0 && errors.length === 0 && queries.length === 0) {
        container.innerHTML = '';
        return;
      }
      var h = '<div class="server-activity-header">Server Activity</div>';
      if (fetches.length > 0) {
        h += '<div class="sa-section"><div class="sa-label">Fetches (' + fetches.length + ')</div>';
        for (var i = 0; i < fetches.length; i++) {
          var f = fetches[i];
          var sCls = f.statusCode >= 400 ? ' style="color:var(--red)"' : '';
          h += '<div class="sa-row">' +
            '<span class="sa-method">' + escHtml(f.method) + '</span>' +
            '<span class="sa-url" title="' + escHtml(f.url) + '">' + escHtml(f.url) + '</span>' +
            '<span class="sa-status"' + sCls + '>' + f.statusCode + '</span>' +
            '<span class="sa-dur">' + formatDuration(f.durationMs) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      if (logs.length > 0) {
        h += '<div class="sa-section"><div class="sa-label">Logs (' + logs.length + ')</div>';
        for (var j = 0; j < logs.length; j++) {
          var l = logs[j];
          var lColor = LOG_LEVEL_COLORS[l.level] || 'var(--fg)';
          h += '<div class="sa-row">' +
            '<span class="sa-level" style="color:' + lColor + '">' + l.level.toUpperCase() + '</span>' +
            '<span class="sa-msg" title="' + escHtml(l.message) + '">' + escHtml(l.message) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      if (queries.length > 0) {
        h += '<div class="sa-section"><div class="sa-label">Queries (' + queries.length + ')</div>';
        for (var qi = 0; qi < queries.length; qi++) {
          var q = queries[qi];
          var qInfo = q.sql ? simplifySQL(q.sql) : { op: q.operation || '?', table: q.model || '', summary: (q.model ? q.model + '.' : '') + (q.operation || '?') };
          var qOpColor = QUERY_OP_COLORS[qInfo.op] || 'var(--fg)';
          var qSlow = q.durationMs > ${SLOW_QUERY_THRESHOLD_MS} ? ' style="color:var(--red)"' : '';
          h += '<div class="sa-row">' +
            '<span class="sa-method" style="color:' + qOpColor + '">' + escHtml(qInfo.op) + '</span>' +
            '<span class="sa-url">' + escHtml(qInfo.table) + '</span>' +
            '<span class="sa-dur"' + qSlow + '>' + queryDuration(q.durationMs) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      if (errors.length > 0) {
        h += '<div class="sa-section"><div class="sa-label" style="color:var(--red)">Errors (' + errors.length + ')</div>';
        for (var k = 0; k < errors.length; k++) {
          var e = errors[k];
          h += '<div class="sa-row">' +
            '<span class="sa-err-name">' + escHtml(e.name) + '</span>' +
            '<span class="sa-msg" title="' + escHtml(e.message) + '">' + escHtml(e.message) + '</span>' +
          '</div>';
        }
        h += '</div>';
      }
      container.innerHTML = h;
    } catch(ex) {
      container.innerHTML = '';
    }
  }
  `;
}
