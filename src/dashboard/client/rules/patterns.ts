export function getSecurityPatterns(): string {
  return `
  var SECRET_KEYS = /^(password|passwd|secret|api_key|apiKey|api_secret|apiSecret|private_key|privateKey|client_secret|clientSecret)$/;
  var TOKEN_PARAMS = /^(token|api_key|apiKey|secret|password|access_token|session_id|sessionId)$/;
  var SAFE_PARAMS = /^(_rsc|__clerk_handshake|__clerk_db_jwt|callback|code|state|nonce|redirect_uri|utm_|fbclid|gclid)$/;
  var STACK_TRACE_RE = /at\\s+.+\\(.+:\\d+:\\d+\\)|at\\s+Module\\._compile|at\\s+Object\\.<anonymous>|at\\s+processTicksAndRejections/;
  var DB_CONN_RE = /(postgres|mysql|mongodb|redis):\\/\\//;
  var SQL_FRAGMENT_RE = /\\b(SELECT\\s+[\\w.*]+\\s+FROM|INSERT\\s+INTO|UPDATE\\s+\\w+\\s+SET|DELETE\\s+FROM)\\b/i;
  var SECRET_VAL_RE = /(api_key|apiKey|secret|token)\\s*[:=]\\s*["']?[A-Za-z0-9_\\-\\.\\+\\/]{8,}/;
  var LOG_SECRET_RE = /(password|secret|token|api_key|apiKey)\\s*[:=]\\s*["']?[A-Za-z0-9_\\-\\.\\+\\/]{8,}/i;

  var RULE_HINTS = {
    'exposed-secret': 'Never include secret fields in API responses. Strip sensitive fields before returning.',
    'token-in-url': 'Pass tokens in the Authorization header, not URL query parameters.',
    'stack-trace-leak': 'Use a custom error handler that returns generic messages in production.',
    'error-info-leak': 'Sanitize error responses. Return generic messages instead of internal details.',
    'sensitive-logs': 'Redact PII before logging. Never log passwords or tokens.',
    'cors-credentials': 'Cannot use credentials:true with origin:*. Specify explicit origins.',
    'insecure-cookie': 'Set HttpOnly and SameSite flags on all cookies.'
  };
  `;
}
