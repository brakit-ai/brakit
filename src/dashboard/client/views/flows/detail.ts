export function getFlowDetail(): string {
  return `
  function createFlowSubReqs(flow) {
    var container = document.createElement('div');
    container.className = 'flow-subreqs';
    flow.requests.forEach(function(req) {
      var isDup = req.isDuplicate;
      var sClass = req.statusCode >= 500 ? 'status-pill-5xx' : req.statusCode >= 400 ? 'status-pill-4xx' : req.statusCode >= 300 ? 'status-pill-3xx' : 'status-pill-2xx';
      var subRow = document.createElement('div');
      subRow.className = 'flow-subreq';
      var methodEl = document.createElement('span');
      methodEl.className = 'method-badge method-badge-' + req.method;
      methodEl.textContent = req.method;
      var labelEl = document.createElement('span');
      labelEl.className = 'subreq-label' + (isDup ? ' is-dup' : '');
      labelEl.textContent = req.path || req.url;
      var statusEl = document.createElement('span');
      statusEl.className = 'status-pill ' + sClass;
      statusEl.textContent = String(req.statusCode);
      var durEl = document.createElement('span');
      durEl.className = 'subreq-dur';
      durEl.textContent = req.pollingDurationMs ? formatDuration(req.pollingDurationMs) : formatDuration(req.durationMs);
      subRow.appendChild(methodEl);
      subRow.appendChild(labelEl);
      if (isDup) {
        var dupTag = document.createElement('span');
        dupTag.className = 'subreq-dup-tag';
        dupTag.textContent = 'duplicate';
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
          var tlEl = detail.querySelector('.request-timeline');
          if (tlEl) loadTimeline(tlEl.getAttribute('data-request-id'), tlEl, 0);
        }
      });
      container.appendChild(subRow);
      container.appendChild(detail);
    });
    return container;
  }

  function renderDetail(req) {
    var sClass = req.statusCode >= 500 ? 'status-pill-5xx' : req.statusCode >= 400 ? 'status-pill-4xx' : req.statusCode >= 300 ? 'status-pill-3xx' : 'status-pill-2xx';
    var h = '<div class="detail-meta">';
    h += '<span><span class="method-badge method-badge-' + req.method + '">' + req.method + '</span> ' + escHtml(req.url) + '</span>';
    h += '<span><span class="status-pill ' + sClass + '">' + req.statusCode + '</span></span>';
    h += '<span>' + req.durationMs + 'ms</span>';
    if (req.responseSize) h += '<span>' + formatSize(req.responseSize) + '</span>';
    h += '</div>';
    h += '<div class="request-timeline" data-request-id="' + req.id + '" data-request-started="' + req.startedAt + '"></div>';
    h += '<div class="detail-grid">';
    h += '<div class="detail-section"><h4>Request Headers</h4><pre>' + formatHeaders(req.headers) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Headers</h4><pre>' + formatHeaders(req.responseHeaders) + '</pre></div>';
    h += '<div class="detail-section"><h4>Request Body</h4><pre>' + formatJsonBody(req.requestBody) + '</pre></div>';
    h += '<div class="detail-section"><h4>Response Body</h4><pre>' + formatJsonBody(req.responseBody) + '</pre></div>';
    h += '</div>';
    h += '<div class="detail-actions"><button class="btn btn-curl">Copy cURL</button></div>';
    return h;
  }
  `;
}
