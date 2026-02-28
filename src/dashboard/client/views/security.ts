import { SEVERITY_MAP } from "../constants/display.js";

export function getSecurityView(): string {
  return `
  function renderSecurity() {
    var container = document.getElementById('security-content');
    if (!container) return;
    container.innerHTML = '';
    var SEV = ${SEVERITY_MAP};

    var all = state.findings || [];
    var open = all.filter(function(f) { return f.state === 'open' || f.state === 'fixing'; });
    var resolved = all.filter(function(f) { return f.state === 'resolved'; });

    if (open.length === 0 && resolved.length === 0) {
      var hasData = state.requests.length > 0 || state.logs.length > 0 || state.queries.length > 0;
      if (!hasData) {
        container.innerHTML = '<div class="empty" style="height:400px"><span class="empty-title">Waiting for requests...</span><span class="empty-sub">Start using your app to see security findings here</span></div>';
      } else {
        container.innerHTML = '<div class="sec-clear"><span class="sec-clear-icon">\\u2713</span><div class="sec-clear-text"><div class="sec-clear-title">All clear</div><div class="sec-clear-sub">No security or quality issues detected this session</div></div></div>';
      }
      return;
    }

    var critCount = 0, warnCount = 0, infoCount = 0;
    for (var ci = 0; ci < open.length; ci++) {
      var sev = open[ci].finding.severity;
      if (sev === 'critical') critCount++;
      else if (sev === 'info') infoCount++;
      else warnCount++;
    }

    var summaryEl = document.createElement('div');
    summaryEl.className = 'sec-summary';
    summaryEl.innerHTML =
      '<div class="sec-summary-left">' +
        '<span class="sec-summary-count">' + open.length + '</span>' +
        '<span class="sec-summary-label">open issue' + (open.length !== 1 ? 's' : '') + '</span>' +
        (resolved.length > 0 ? '<span class="sec-resolved-badge">' + resolved.length + ' resolved</span>' : '') +
      '</div>' +
      '<div class="sec-summary-right">' +
        (critCount > 0 ? '<span class="sec-badge critical">' + critCount + ' critical</span>' : '') +
        (warnCount > 0 ? '<span class="sec-badge warning">' + warnCount + ' warning</span>' : '') +
        (infoCount > 0 ? '<span class="sec-badge info">' + infoCount + ' info</span>' : '') +
      '</div>';
    container.appendChild(summaryEl);

    if (open.length === 0 && resolved.length > 0) {
      var allFixed = document.createElement('div');
      allFixed.className = 'sec-clear';
      allFixed.innerHTML = '<span class="sec-clear-icon">\\u2713</span><div class="sec-clear-text"><div class="sec-clear-title">All issues resolved</div><div class="sec-clear-sub">' + resolved.length + ' finding' + (resolved.length !== 1 ? 's were' : ' was') + ' detected and fixed</div></div>';
      container.appendChild(allFixed);
    }

    if (open.length > 0) {
      var groups = {};
      var groupOrder = [];
      for (var gi = 0; gi < open.length; gi++) {
        var f = open[gi].finding;
        if (!groups[f.rule]) {
          groups[f.rule] = { rule: f.rule, title: f.title, severity: f.severity, hint: f.hint, items: [] };
          groupOrder.push(f.rule);
        }
        groups[f.rule].items.push(f);
      }

      groupOrder.sort(function(a, b) {
        var sa = SEV[groups[a].severity].sort;
        var sb = SEV[groups[b].severity].sort;
        if (sa !== sb) return sa - sb;
        return groups[b].items.length - groups[a].items.length;
      });

      for (var oi = 0; oi < groupOrder.length; oi++) {
        var group = groups[groupOrder[oi]];
        var section = document.createElement('div');
        section.className = 'sec-group';

        var sevCfg = SEV[group.severity];
        var iconCls = sevCfg.cls;
        var iconChar = sevCfg.icon;

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

    if (resolved.length > 0) {
      var resolvedTitle = document.createElement('div');
      resolvedTitle.className = 'sec-resolved-title';
      resolvedTitle.innerHTML = '<span class="sec-resolved-check">\\u2713</span> Resolved <span class="sec-resolved-count">' + resolved.length + '</span>';
      container.appendChild(resolvedTitle);

      var resolvedGroup = document.createElement('div');
      resolvedGroup.className = 'sec-group sec-group-resolved';
      var resolvedItems = document.createElement('div');
      resolvedItems.className = 'sec-items';
      for (var ri = 0; ri < resolved.length; ri++) {
        var rf = resolved[ri].finding;
        var rRow = document.createElement('div');
        rRow.className = 'sec-item sec-item-resolved';
        rRow.innerHTML =
          '<span class="sec-resolved-item-icon">\\u2713</span>' +
          '<div class="sec-item-desc">' + escHtml(rf.title) + ' \\u2014 ' + escHtml(rf.endpoint) + '</div>';
        resolvedItems.appendChild(rRow);
      }
      resolvedGroup.appendChild(resolvedItems);
      container.appendChild(resolvedGroup);
    }
  }
  `;
}
