export function getSecurityView(): string {
  return `
  function renderSecurity() {
    var container = document.getElementById('security-content');
    if (!container) return;
    container.innerHTML = '';

    var findings = computeSecurityFindings();

    if (findings.length === 0) {
      var hasData = state.requests.length > 0 || state.logs.length > 0 || state.queries.length > 0;
      if (!hasData) {
        container.innerHTML = '<div class="empty" style="height:400px"><span class="empty-title">Waiting for requests...</span><span class="empty-sub">Start using your app to see security findings here</span></div>';
      } else {
        container.innerHTML = '<div class="sec-clear"><span class="sec-clear-icon">\\u2713</span><div class="sec-clear-text"><div class="sec-clear-title">All clear</div><div class="sec-clear-sub">No security or quality issues detected this session</div></div></div>';
      }
      return;
    }

    // Summary bar
    var critCount = 0, warnCount = 0, infoCount = 0;
    for (var ci = 0; ci < findings.length; ci++) {
      if (findings[ci].severity === 'critical') critCount++;
      else if (findings[ci].severity === 'info') infoCount++;
      else warnCount++;
    }
    var summaryEl = document.createElement('div');
    summaryEl.className = 'sec-summary';
    summaryEl.innerHTML =
      '<div class="sec-summary-left">' +
        '<span class="sec-summary-count">' + findings.length + '</span>' +
        '<span class="sec-summary-label">issue' + (findings.length !== 1 ? 's' : '') + ' found</span>' +
      '</div>' +
      '<div class="sec-summary-right">' +
        (critCount > 0 ? '<span class="sec-badge critical">' + critCount + ' critical</span>' : '') +
        (warnCount > 0 ? '<span class="sec-badge warning">' + warnCount + ' warning</span>' : '') +
        (infoCount > 0 ? '<span class="sec-badge info">' + infoCount + ' info</span>' : '') +
      '</div>';
    container.appendChild(summaryEl);

    // Group findings by rule
    var groups = {};
    var groupOrder = [];
    for (var gi = 0; gi < findings.length; gi++) {
      var f = findings[gi];
      if (!groups[f.rule]) {
        groups[f.rule] = { rule: f.rule, title: f.title, severity: f.severity, hint: f.hint, items: [] };
        groupOrder.push(f.rule);
      }
      groups[f.rule].items.push(f);
    }

    // Sort groups: critical first, then warning, then info
    groupOrder.sort(function(a, b) {
      var sa = groups[a].severity === 'critical' ? 0 : groups[a].severity === 'warning' ? 1 : 2;
      var sb = groups[b].severity === 'critical' ? 0 : groups[b].severity === 'warning' ? 1 : 2;
      if (sa !== sb) return sa - sb;
      return groups[b].items.length - groups[a].items.length;
    });

    // Render groups
    for (var oi = 0; oi < groupOrder.length; oi++) {
      var group = groups[groupOrder[oi]];
      var section = document.createElement('div');
      section.className = 'sec-group';

      var iconCls = group.severity === 'critical' ? 'critical' : group.severity === 'info' ? 'info' : 'warning';
      var iconChar = group.severity === 'critical' ? '\\u2717' : group.severity === 'info' ? '\\u2139' : '\\u26A0';

      var header = document.createElement('div');
      header.className = 'sec-group-header';
      header.innerHTML =
        '<span class="sec-group-icon ' + iconCls + '">' + iconChar + '</span>' +
        '<span class="sec-group-title">' + escHtml(group.title) + '</span>' +
        '<span class="sec-group-count">' + group.items.length + '</span>';
      section.appendChild(header);

      if (group.hint) {
        var hintEl = document.createElement('div');
        hintEl.className = 'sec-hint';
        hintEl.textContent = group.hint;
        section.appendChild(hintEl);
      }

      var list = document.createElement('div');
      list.className = 'sec-items';
      for (var ii = 0; ii < group.items.length; ii++) {
        var item = group.items[ii];
        var row = document.createElement('div');
        row.className = 'sec-item';
        row.innerHTML =
          '<div class="sec-item-desc">' + item.desc + '</div>' +
          (item.count > 1 ? '<span class="sec-item-count">' + item.count + 'x</span>' : '');
        list.appendChild(row);
      }
      section.appendChild(list);
      container.appendChild(section);
    }
  }
  `;
}
