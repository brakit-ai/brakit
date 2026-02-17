export function getCriticalRules(): string {
  return `
  function ruleExposedSecret(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (r.statusCode >= 400) continue;
      var parsed = tryParseJson(r.responseBody);
      if (!parsed) continue;
      var keys = findSecretKeys(parsed, '');
      if (keys.length === 0) continue;
      var ep = r.method + ' ' + r.path;
      var key = ep + ':' + keys.sort().join(',');
      if (seen[key]) { seen[key].count++; continue; }
      seen[key] = {
        severity: 'critical', type: 'security', rule: 'exposed-secret',
        title: 'Exposed Secret in Response',
        desc: '<strong>' + escHtml(ep) + '</strong> — response contains <strong>' + escHtml(keys.join(', ')) + '</strong> field' + (keys.length > 1 ? 's' : ''),
        nav: 'security', hint: RULE_HINTS['exposed-secret'], endpoint: ep, count: 1
      };
      findings.push(seen[key]);
    }
  }

  function ruleTokenInUrl(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      var qIdx = r.url.indexOf('?');
      if (qIdx === -1) continue;
      var params = r.url.substring(qIdx + 1).split('&');
      var flagged = [];
      for (var pi = 0; pi < params.length; pi++) {
        var parts = params[pi].split('=');
        var name = parts[0];
        var val = parts.slice(1).join('=');
        if (SAFE_PARAMS.test(name)) continue;
        if (TOKEN_PARAMS.test(name) && val && val.length > 0) {
          flagged.push(name);
        }
      }
      if (flagged.length === 0) continue;
      var ep = r.method + ' ' + r.path;
      var key = ep + ':' + flagged.sort().join(',');
      if (seen[key]) { seen[key].count++; continue; }
      seen[key] = {
        severity: 'critical', type: 'security', rule: 'token-in-url',
        title: 'Auth Token in URL',
        desc: '<strong>' + escHtml(ep) + '</strong> — <strong>' + escHtml(flagged.join(', ')) + '</strong> exposed in query string',
        nav: 'security', hint: RULE_HINTS['token-in-url'], endpoint: ep, count: 1
      };
      findings.push(seen[key]);
    }
  }

  function ruleStackTraceLeak(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (!r.responseBody) continue;
      if (!STACK_TRACE_RE.test(r.responseBody)) continue;
      var ep = r.method + ' ' + r.path;
      if (seen[ep]) { seen[ep].count++; continue; }
      seen[ep] = {
        severity: 'critical', type: 'security', rule: 'stack-trace-leak',
        title: 'Stack Trace Leaked to Client',
        desc: '<strong>' + escHtml(ep) + '</strong> — response exposes internal stack trace',
        nav: 'security', hint: RULE_HINTS['stack-trace-leak'], endpoint: ep, count: 1
      };
      findings.push(seen[ep]);
    }
  }

  function ruleErrorInfoLeak(requests, findings) {
    var seen = {};
    var patterns = [
      { re: EMAIL_RE, label: 'email address' },
      { re: DB_CONN_RE, label: 'database connection string' },
      { re: INTERNAL_PATH_RE, label: 'internal file path' },
      { re: INTERNAL_URL_RE, label: 'internal service URL' },
      { re: SQL_FRAGMENT_RE, label: 'SQL query fragment' },
      { re: SECRET_VAL_RE, label: 'secret value' }
    ];
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (r.statusCode < 400) continue;
      if (!r.responseBody) continue;
      if (r.responseHeaders && (r.responseHeaders['x-nextjs-error'] || r.responseHeaders['x-nextjs-matched-path'])) continue;
      var ep = r.method + ' ' + r.path;
      for (var pi = 0; pi < patterns.length; pi++) {
        var p = patterns[pi];
        if (!p.re.test(r.responseBody)) continue;
        var key = ep + ':' + p.label;
        if (seen[key]) { seen[key].count++; continue; }
        seen[key] = {
          severity: 'critical', type: 'security', rule: 'error-info-leak',
          title: 'Sensitive Data in Error Response',
          desc: '<strong>' + escHtml(ep) + '</strong> — error response exposes <strong>' + p.label + '</strong>',
          nav: 'security', hint: RULE_HINTS['error-info-leak'], endpoint: ep, count: 1
        };
        findings.push(seen[key]);
      }
    }
  }

  function ruleInsecureCookie(requests, findings) {
    var seen = {};
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (!r.responseHeaders) continue;
      var setCookie = r.responseHeaders['set-cookie'];
      if (!setCookie) continue;
      var cookies = setCookie.split(/,(?=\\s*[A-Za-z0-9_\\-]+=)/);
      for (var ci = 0; ci < cookies.length; ci++) {
        var cookie = cookies[ci].trim();
        var cookieName = cookie.split('=')[0].trim();
        var lower = cookie.toLowerCase();
        var issues = [];
        if (lower.indexOf('httponly') === -1) issues.push('HttpOnly');
        if (lower.indexOf('secure') === -1) issues.push('Secure');
        if (lower.indexOf('samesite') === -1) issues.push('SameSite');
        if (issues.length === 0) continue;
        var key = cookieName + ':' + issues.join(',');
        if (seen[key]) { seen[key].count++; continue; }
        seen[key] = {
          severity: 'critical', type: 'security', rule: 'insecure-cookie',
          title: 'Insecure Cookie',
          desc: '<strong>' + escHtml(cookieName) + '</strong> — missing <strong>' + issues.join(', ') + '</strong> flag' + (issues.length > 1 ? 's' : ''),
          nav: 'security', hint: RULE_HINTS['insecure-cookie'], endpoint: cookieName, count: 1
        };
        findings.push(seen[key]);
      }
    }
  }
  `;
}
