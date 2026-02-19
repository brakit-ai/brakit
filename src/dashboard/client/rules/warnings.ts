export function getWarningRules(): string {
  return `
  function ruleSensitiveLogs(findings) {
    var count = 0;
    for (var i = 0; i < state.logs.length; i++) {
      var msg = state.logs[i].message;
      if (!msg) continue;
      if (msg.indexOf('[brakit]') === 0) continue;
      if (LOG_SECRET_RE.test(msg)) count++;
    }
    if (count > 0) {
      findings.push({
        severity: 'warning', type: 'security', rule: 'sensitive-logs',
        title: 'Sensitive Data in Logs',
        desc: 'Console output contains <strong>secret/token values</strong> — ' + count + ' occurrence' + (count !== 1 ? 's' : ''),
        nav: 'security', hint: RULE_HINTS['sensitive-logs'], endpoint: 'console', count: count
      });
    }
  }

  function ruleCorsCredentials(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (!r.responseHeaders) continue;
      var origin = r.responseHeaders['access-control-allow-origin'];
      var creds = r.responseHeaders['access-control-allow-credentials'];
      if (origin !== '*' || creds !== 'true') continue;
      var ep = r.method + ' ' + r.path;
      if (seen[ep]) continue;
      seen[ep] = true;
      findings.push({
        severity: 'warning', type: 'security', rule: 'cors-credentials',
        title: 'CORS Credentials with Wildcard',
        desc: '<strong>' + escHtml(ep) + '</strong> — credentials:true with origin:* (browser will reject)',
        nav: 'security', hint: RULE_HINTS['cors-credentials'], endpoint: ep, count: 1
      });
    }
  }
  `;
}
