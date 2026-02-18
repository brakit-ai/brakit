import { DASHBOARD_API_ERRORS } from "../../../constants/index.js";

export function getErrorsView(): string {
  return `
  function buildErrorRow(e) {
    var row = document.createElement('div');
    row.className = 'req-row tel-clickable';
    var ts = new Date(e.timestamp).toLocaleTimeString();
    row.innerHTML =
      '<span class="tel-error-name">' + escHtml(e.name) + '</span>' +
      '<span class="tel-message" title="' + escHtml(e.message) + '">' + escHtml(e.message) + '</span>' +
      '<span class="tel-timestamp">' + ts + '</span>';
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
        stackEl.textContent = e.stack;
        row.parentNode.insertBefore(stackEl, row.nextSibling);
      }
    });
    return row;
  }

  var errorView = createTelemetryView('error-list', buildErrorRow);
  function renderErrors() { errorView.render(state.errors); }
  function prependErrorRow(e) { errorView.prepend(e); }

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
