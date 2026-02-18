export function getWarningRules(): string {
  return `
  function ruleCorsWildcard(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (!r.responseHeaders) continue;
      var origin = r.responseHeaders['access-control-allow-origin'];
      if (origin !== '*') continue;
      var ep = r.method + ' ' + r.path;
      if (seen[ep]) { seen[ep].count++; continue; }
      seen[ep] = {
        severity: 'warning', type: 'security', rule: 'cors-wildcard',
        title: 'CORS Allows All Origins',
        desc: '<strong>' + escHtml(ep) + '</strong> — Access-Control-Allow-Origin is <strong>*</strong>',
        nav: 'security', hint: RULE_HINTS['cors-wildcard'], endpoint: ep, count: 1
      };
      findings.push(seen[ep]);
    }
  }

  function ruleNoAuthData(requests, findings) {
    var seen = {};
    var authPaths = /\\/(auth|login|logout|register|signup|signin|callback|verify|confirm|reset)/i;
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (r.statusCode !== 200) continue;
      var ct = r.responseHeaders && r.responseHeaders['content-type'];
      if (!ct || ct.indexOf('json') === -1) continue;
      if (r.headers['authorization'] || r.headers['cookie']) continue;
      if (authPaths.test(r.path)) continue;
      var parsed = tryParseJson(r.responseBody);
      if (!parsed) continue;
      var piiFields = hasPiiFields(parsed);
      if (piiFields.length === 0) continue;
      var ep = r.method + ' ' + r.path;
      if (seen[ep]) continue;
      seen[ep] = true;
      findings.push({
        severity: 'warning', type: 'security', rule: 'no-auth-data',
        title: 'No Auth on Data Endpoint',
        desc: '<strong>' + escHtml(ep) + '</strong> — returns <strong>' + escHtml(piiFields.slice(0, 3).join(', ')) + '</strong> with no auth',
        nav: 'security', hint: RULE_HINTS['no-auth-data'], endpoint: ep, count: 1
      });
    }
  }

  function ruleSensitiveLogs(findings) {
    var counts = { email: 0, secret: 0, creditCard: 0 };
    for (var i = 0; i < state.logs.length; i++) {
      var msg = state.logs[i].message;
      if (!msg) continue;
      if (msg.indexOf('[brakit]') === 0) continue;
      if (EMAIL_RE.test(msg)) counts.email++;
      if (LOG_SECRET_RE.test(msg)) counts.secret++;
      if (CC_RE.test(msg)) counts.creditCard++;
    }
    if (counts.email > 0) {
      findings.push({
        severity: 'warning', type: 'security', rule: 'sensitive-logs',
        title: 'Sensitive Data in Logs',
        desc: 'Console output contains <strong>email addresses</strong> — ' + counts.email + ' occurrence' + (counts.email !== 1 ? 's' : ''),
        nav: 'security', hint: RULE_HINTS['sensitive-logs'], endpoint: 'console', count: counts.email
      });
    }
    if (counts.secret > 0) {
      findings.push({
        severity: 'warning', type: 'security', rule: 'sensitive-logs',
        title: 'Sensitive Data in Logs',
        desc: 'Console output contains <strong>secret/token values</strong> — ' + counts.secret + ' occurrence' + (counts.secret !== 1 ? 's' : ''),
        nav: 'security', hint: RULE_HINTS['sensitive-logs'], endpoint: 'console', count: counts.secret
      });
    }
    if (counts.creditCard > 0) {
      findings.push({
        severity: 'warning', type: 'security', rule: 'sensitive-logs',
        title: 'Sensitive Data in Logs',
        desc: 'Console output contains <strong>credit card numbers</strong> — ' + counts.creditCard + ' occurrence' + (counts.creditCard !== 1 ? 's' : ''),
        nav: 'security', hint: RULE_HINTS['sensitive-logs'], endpoint: 'console', count: counts.creditCard
      });
    }
  }

  function ruleUnboundedQuery(findings) {
    var seen = {};
    var sysTable = /pg_catalog|information_schema|pg_|sqlite_/i;
    for (var i = 0; i < state.queries.length; i++) {
      var q = state.queries[i];
      if (!q.sql) continue;
      var trimmed = q.sql.trim();
      if (!/^SELECT/i.test(trimmed)) continue;
      if (/\\bWHERE\\b/i.test(trimmed) || /\\bLIMIT\\b/i.test(trimmed)) continue;
      if (/^SELECT\\s+(1|COUNT)/i.test(trimmed)) continue;
      var info = simplifySQL(q.sql);
      if (!info.table || sysTable.test(info.table)) continue;
      if (q.rowCount !== undefined && q.rowCount <= 1) continue;
      var key = info.table;
      if (seen[key]) { seen[key].count++; continue; }
      seen[key] = {
        severity: 'warning', type: 'security', rule: 'unbounded-query',
        title: 'Unbounded Query',
        desc: '<strong>SELECT from ' + escHtml(info.table) + '</strong> — no WHERE or LIMIT clause',
        nav: 'security', hint: RULE_HINTS['unbounded-query'], endpoint: info.table, count: 1
      };
      findings.push(seen[key]);
    }
  }

  function rule200Error(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (r.statusCode !== 200) continue;
      var parsed = tryParseJson(r.responseBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      var isError = false;
      if (parsed.error && parsed.error !== false) isError = true;
      if (parsed.success === false) isError = true;
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
        if (parsed.data !== undefined && parsed.data !== null) continue;
        isError = true;
      }
      if (!isError) continue;
      var ep = r.method + ' ' + r.path;
      if (seen[ep]) { seen[ep].count++; continue; }
      seen[ep] = {
        severity: 'warning', type: 'security', rule: '200-error',
        title: 'Error Body with 200 Status',
        desc: '<strong>' + escHtml(ep) + '</strong> — returns 200 but response body contains error',
        nav: 'security', hint: RULE_HINTS['200-error'], endpoint: ep, count: 1
      };
      findings.push(seen[ep]);
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

  function ruleMissingSecurityHeaders(requests, findings) {
    var checked = {};
    var devHeaders = [
      { header: 'x-content-type-options', expected: 'nosniff', label: 'X-Content-Type-Options' },
      { header: 'x-frame-options', expected: null, label: 'X-Frame-Options' }
    ];
    var prodHeaders = [
      { header: 'strict-transport-security', expected: null, label: 'Strict-Transport-Security' }
    ];
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (!r.responseHeaders) continue;
      var ct = r.responseHeaders['content-type'] || '';
      if (ct.indexOf('json') === -1 && ct.indexOf('html') === -1) continue;
      var ep = r.method + ' ' + r.path;
      for (var hi = 0; hi < devHeaders.length; hi++) {
        var check = devHeaders[hi];
        var val = r.responseHeaders[check.header];
        if (val) continue;
        var key = ep + ':' + check.header;
        if (checked[key]) continue;
        checked[key] = true;
        var ruleKey = 'missing:' + check.header;
        if (!checked[ruleKey]) {
          checked[ruleKey] = {
            severity: 'info', type: 'security', rule: 'missing-security-headers',
            title: 'Verify Header in Production',
            desc: '<strong>' + check.label + '</strong> header not set on dev server responses',
            nav: 'security', hint: RULE_HINTS['missing-security-headers'], endpoint: check.label, count: 1
          };
          findings.push(checked[ruleKey]);
        } else {
          checked[ruleKey].count++;
        }
      }
      for (var pi = 0; pi < prodHeaders.length; pi++) {
        var pcheck = prodHeaders[pi];
        var pval = r.responseHeaders[pcheck.header];
        if (pval) continue;
        var pkey = ep + ':' + pcheck.header;
        if (checked[pkey]) continue;
        checked[pkey] = true;
        var pruleKey = 'missing-prod:' + pcheck.header;
        if (!checked[pruleKey]) {
          checked[pruleKey] = {
            severity: 'info', type: 'security', rule: 'missing-security-headers-prod',
            title: 'Verify Header in Production',
            desc: '<strong>' + pcheck.label + '</strong> not set — expected in dev, but verify it\\'s configured for production',
            nav: 'security', hint: RULE_HINTS['missing-security-headers-prod'], endpoint: pcheck.label, count: 1
          };
          findings.push(checked[pruleKey]);
        } else {
          checked[pruleKey].count++;
        }
      }
    }
  }
  `;
}
