/**
 * Shared client-side helpers for telemetry list views (fetches, logs, errors, queries).
 * Eliminates duplicate render/append/prepend boilerplate across view files.
 */
export function getTelemetryViewHelpers(): string {
  return `
  function createTelemetryView(listId, buildRowFn) {
    return {
      render: function(items) {
        var list = document.getElementById(listId);
        if (!list) return;
        list.innerHTML = '';
        items.forEach(function(item) { list.appendChild(buildRowFn(item)); });
      },
      prepend: function(item) {
        var list = document.getElementById(listId);
        if (!list) return;
        list.insertBefore(buildRowFn(item), list.firstChild);
      }
    };
  }
  `;
}
