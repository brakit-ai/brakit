import {
  DASHBOARD_API_ERRORS,
} from "../../../constants.js";

export function getErrorsView(): string {
  return `
  function renderErrors() {
    var list = document.getElementById('error-list');
    if (!list) return;
    list.innerHTML = '';
    state.errors.forEach(function(e) { appendErrorRow(e); });
  }

  function appendErrorRow(e) {
    var list = document.getElementById('error-list');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'req-row';
    row.style.cursor = 'pointer';
    var ts = new Date(e.timestamp).toLocaleTimeString();
    row.innerHTML =
      '<span style="width:120px;color:var(--red);font-weight:500">' + escHtml(e.name) + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(e.message) + '">' + escHtml(e.message) + '</span>' +
      '<span style="width:130px;text-align:right;color:var(--dim)">' + ts + '</span>';
    row.addEventListener('click', function() {
      row.classList.toggle('expanded');
      var existing = row.nextElementSibling;
      if (existing && existing.classList.contains('error-stack')) {
        existing.remove();
        return;
      }
      if (e.stack) {
        var stackEl = document.createElement('div');
        stackEl.className = 'error-stack';
        stackEl.style.cssText = 'padding:8px 16px;font-size:11px;color:var(--dim);white-space:pre-wrap;font-family:monospace;background:var(--bg-dark);border-bottom:1px solid var(--border)';
        stackEl.textContent = e.stack;
        row.parentNode.insertBefore(stackEl, row.nextSibling);
      }
    });
    list.appendChild(row);
  }

  function prependErrorRow(e) {
    var list = document.getElementById('error-list');
    if (!list) return;
    appendErrorRow(e);
    var last = list.lastChild;
    if (last) list.insertBefore(last, list.firstChild);
  }

  async function loadErrors() {
    try {
      var res = await fetch('${DASHBOARD_API_ERRORS}');
      var data = await res.json();
      state.errors = data.entries;
      renderErrors();
    } catch(e) {}
  }
  `;
}
