import { DASHBOARD_PREFIX } from "../../constants.js";

export function getSecurityRules(): string {
  return `
  var SECRET_KEYS = /^(password|passwd|secret|api_key|apiKey|api_secret|apiSecret|private_key|privateKey|client_secret|clientSecret)$/;
  var TOKEN_PARAMS = /^(token|api_key|apiKey|key|secret|auth|password|access_token|session_id|sessionId)$/;
  var SAFE_PARAMS = /^(_rsc|__clerk_handshake|__clerk_db_jwt|callback|code|state|nonce|redirect_uri|utm_|fbclid|gclid)$/;
  var STACK_TRACE_RE = /at\\s+.+\\(.+:\\d+:\\d+\\)|at\\s+Module\\._compile|at\\s+Object\\.<anonymous>|at\\s+processTicksAndRejections/;
  var EMAIL_RE = /[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}/;
  var DB_CONN_RE = /(postgres|mysql|mongodb|redis):\\/\\//;
  var INTERNAL_PATH_RE = /(\\/Users\\/|\\/home\\/|\\/var\\/|\\/app\\/|[A-Z]:\\\\)/;
  var INTERNAL_URL_RE = /(localhost:\\d+|127\\.0\\.0\\.1|0\\.0\\.0\\.0)/;
  var SQL_FRAGMENT_RE = /\\b(SELECT|INSERT|UPDATE|DELETE)\\s+\\w/i;
  var SECRET_VAL_RE = /(api_key|apiKey|secret|token)\\s*[:=]\\s*\\S+/;
  var CC_RE = /\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b/;
  var LOG_SECRET_RE = /(password|secret|token|api_key|apiKey)\\s*[:=]\\s*\\S+/i;

  var PII_KEYS = /^(email|e_mail|phone|phone_number|phoneNumber|ssn|social_security|socialSecurity|date_of_birth|dateOfBirth|dob|address|street|zip_code|zipCode|credit_card|creditCard|bank_account|bankAccount)$/i;

  var RULE_HINTS = {
    'exposed-secret': 'Never include secret fields in API responses. Strip sensitive fields before returning.',
    'token-in-url': 'Pass tokens in the Authorization header, not URL query parameters.',
    'stack-trace-leak': 'Use a custom error handler that returns generic messages in production.',
    'error-info-leak': 'Sanitize error responses. Return generic messages instead of internal details.',
    'cors-wildcard': 'Restrict Access-Control-Allow-Origin to specific trusted domains.',
    'no-auth-data': 'Add authentication middleware to endpoints that return personal data.',
    'sensitive-logs': 'Redact PII before logging. Never log emails, passwords, or tokens.',
    'unbounded-query': 'Add WHERE or LIMIT clauses to prevent full table scans.',
    '200-error': 'Return appropriate HTTP status codes (4xx/5xx) for error responses.',
    'cors-credentials': 'Cannot use credentials:true with origin:*. Specify explicit origins.',
    'insecure-cookie': 'Set HttpOnly, Secure, and SameSite flags on all cookies.',
    'missing-security-headers': 'Add standard security headers to all responses.'
  };

  function computeSecurityFindings() {
    var findings = [];
    var nonDashboard = state.requests.filter(function(r) {
      return !r.isStatic && (!r.path || r.path.indexOf('${DASHBOARD_PREFIX}') !== 0);
    });

    ruleExposedSecret(nonDashboard, findings);
    ruleTokenInUrl(nonDashboard, findings);
    ruleStackTraceLeak(nonDashboard, findings);
    ruleErrorInfoLeak(nonDashboard, findings);
    ruleCorsWildcard(nonDashboard, findings);
    ruleNoAuthData(nonDashboard, findings);
    ruleSensitiveLogs(findings);
    ruleUnboundedQuery(findings);
    rule200Error(nonDashboard, findings);
    ruleCorsCredentials(nonDashboard, findings);
    ruleInsecureCookie(nonDashboard, findings);
    ruleMissingSecurityHeaders(nonDashboard, findings);

    return findings;
  }

  function tryParseJson(body) {
    if (!body) return null;
    try { return JSON.parse(body); } catch(e) { return null; }
  }

  function findSecretKeys(obj, prefix) {
    var found = [];
    if (!obj || typeof obj !== 'object') return found;
    if (Array.isArray(obj)) {
      for (var ai = 0; ai < Math.min(obj.length, 5); ai++) {
        found = found.concat(findSecretKeys(obj[ai], prefix));
      }
      return found;
    }
    for (var k in obj) {
      if (SECRET_KEYS.test(k) && obj[k] && typeof obj[k] === 'string' && obj[k].length > 0) {
        found.push(k);
      }
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        found = found.concat(findSecretKeys(obj[k], prefix + k + '.'));
      }
    }
    return found;
  }

  // Rule 1: Exposed Secret in Response
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

  // Rule 2: Auth Token in URL
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

  // Rule 3: Stack Trace Leaked to Client
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

  // Rule 4: Sensitive Data in Error Response
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
      // Skip Next.js dev overlay
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

  // Rule 5: CORS Allows All Origins
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

  // Rule 6: No Auth on Data Endpoint (only when PII fields present)
  function hasPiiFields(obj) {
    if (!obj || typeof obj !== 'object') return [];
    var items = Array.isArray(obj) ? obj.slice(0, 3) : [obj];
    var found = [];
    for (var ii = 0; ii < items.length; ii++) {
      var item = items[ii];
      if (!item || typeof item !== 'object') continue;
      for (var k in item) {
        if (PII_KEYS.test(k)) found.push(k);
      }
      if (found.length > 0) break;
    }
    return found;
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

  // Rule 7: Sensitive Data in Logs
  function ruleSensitiveLogs(findings) {
    var counts = { email: 0, secret: 0, creditCard: 0 };
    for (var i = 0; i < state.logs.length; i++) {
      var msg = state.logs[i].message;
      if (!msg) continue;
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

  // Rule 8: Unbounded Query (no WHERE)
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

  // Rule 9: Error Body with 200 Status
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
        // Skip GraphQL partial errors (data + errors)
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

  // Rule 10: CORS with Credentials
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

  // Rule 11: Insecure Cookie
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

  // Rule 12: Missing Security Headers
  function ruleMissingSecurityHeaders(requests, findings) {
    var checked = {};
    var headerChecks = [
      { header: 'x-content-type-options', expected: 'nosniff', label: 'X-Content-Type-Options' },
      { header: 'x-frame-options', expected: null, label: 'X-Frame-Options' },
      { header: 'strict-transport-security', expected: null, label: 'Strict-Transport-Security' }
    ];
    // Only check non-static HTML/JSON responses (not every asset)
    for (var i = 0; i < requests.length; i++) {
      var r = requests[i];
      if (!r.responseHeaders) continue;
      var ct = r.responseHeaders['content-type'] || '';
      if (ct.indexOf('json') === -1 && ct.indexOf('html') === -1) continue;
      var ep = r.method + ' ' + r.path;
      for (var hi = 0; hi < headerChecks.length; hi++) {
        var check = headerChecks[hi];
        var val = r.responseHeaders[check.header];
        if (val) continue;
        var key = ep + ':' + check.header;
        if (checked[key]) continue;
        checked[key] = true;
        // Aggregate: one finding per missing header across all endpoints
        var ruleKey = 'missing:' + check.header;
        if (!checked[ruleKey]) {
          checked[ruleKey] = {
            severity: 'warning', type: 'security', rule: 'missing-security-headers',
            title: 'Missing Security Header',
            desc: '<strong>' + check.label + '</strong> header not set on API responses',
            nav: 'security', hint: RULE_HINTS['missing-security-headers'], endpoint: check.label, count: 1
          };
          findings.push(checked[ruleKey]);
        } else {
          checked[ruleKey].count++;
        }
      }
    }
  }
  `;
}
