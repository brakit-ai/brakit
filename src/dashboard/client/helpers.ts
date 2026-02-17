import {
  CLIENT_SENSITIVE_MASK_THRESHOLD,
  CLIENT_TOAST_DURATION_MS,
} from "../../constants.js";

export function getHelpers(): string {
  return `
  function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  }
  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return bytes + 'b';
    return (bytes / 1024).toFixed(1) + 'kb';
  }
  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function statusIcon(code) {
    if (code >= 500) return { icon: '\\u2717', cls: 'status-error', tip: code + ' Server Error' };
    if (code >= 400) return { icon: '\\u2717', cls: 'status-fail', tip: code + ' ' + httpStatus(code) };
    if (code >= 300) return { icon: '\\u2713', cls: 'status-ok', tip: code + ' Redirect' };
    return { icon: '\\u2713', cls: 'status-ok', tip: code + ' OK' };
  }

  function httpStatus(code) {
    var map = {400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',408:'Timeout',409:'Conflict',422:'Unprocessable',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'};
    return map[code] || (code >= 500 ? 'Server Error' : code >= 400 ? 'Client Error' : 'OK');
  }

  var SENSITIVE = new Set(['cookie','set-cookie','authorization','proxy-authorization','x-api-key','x-auth-token']);
  function maskValue(k, v) {
    if (SENSITIVE.has(k.toLowerCase())) {
      var s = String(v);
      if (s.length <= ${CLIENT_SENSITIVE_MASK_THRESHOLD}) return '****';
      return s.slice(0, 4) + '...' + s.slice(-4) + ' (' + s.length + ' chars)';
    }
    return String(v);
  }
  function formatHeaders(headers) {
    if (!headers || Object.keys(headers).length === 0) return '<span style="color:var(--text-muted)">No headers</span>';
    return Object.entries(headers).map(function(e) { return '<span class="json-key">' + escHtml(e[0]) + '</span>: ' + escHtml(maskValue(e[0], e[1])); }).join('\\n');
  }

  function buildBodyToggle(direction, label, body) {
    var block = document.createElement('div');
    block.className = 'traffic-body';
    var toggle = document.createElement('button');
    toggle.className = 'traffic-body-toggle';
    toggle.innerHTML = '<span class="chevron">\\u25B8</span><span class="arrow-' + direction + '">' + (direction === 'out' ? '\\u2192' : '\\u2190') + '</span> ' + label;
    var pre = document.createElement('pre');
    pre.innerHTML = formatJsonBody(body);
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      toggle.classList.toggle('open');
      pre.classList.toggle('open');
    });
    block.appendChild(toggle);
    block.appendChild(pre);
    return block;
  }

  function formatJsonBody(body) {
    if (!body) return '<span style="color:var(--text-muted)">No body</span>';
    try {
      var parsed = JSON.parse(body);
      return highlightJson(JSON.stringify(parsed, null, 2));
    } catch(e) { return escHtml(body); }
  }
  function highlightJson(json) {
    return escHtml(json).replace(
      /("(?:[^"\\\\\\\\]|\\\\\\\\.)*")(\\\\s*:)?|\\\\b(true|false)\\\\b|\\\\bnull\\\\b|(-?\\\\d+\\\\.?\\\\d*(?:[eE][+-]?\\\\d+)?)/g,
      function(m, str, colon, bool, num) {
        if (str) return colon ? '<span class="json-key">' + str + '</span>' + colon : '<span class="json-str">' + str + '</span>';
        if (bool) return '<span class="json-bool">' + m + '</span>';
        if (num) return '<span class="json-num">' + m + '</span>';
        if (m === 'null') return '<span class="json-null">null</span>';
        return m;
      }
    );
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(function() { toastEl.classList.remove('show'); }, ${CLIENT_TOAST_DURATION_MS});
  }
  `;
}
