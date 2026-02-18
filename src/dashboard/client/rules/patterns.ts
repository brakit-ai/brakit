export function getSecurityPatterns(): string {
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
  var LOG_SECRET_RE = /(password|secret|token|api_key|apiKey)\\s*[:=]\\s*["']?[A-Za-z0-9_\\-\\.\\+\\/]{8,}/i;

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
    'missing-security-headers': 'Dev servers often omit these headers. Verify your production deployment (framework, reverse proxy, or CDN) sets them.',
    'missing-security-headers-prod': 'HSTS is not expected on localhost. Verify your production deployment (reverse proxy, CDN, or framework config) sets this header.'
  };
  `;
}
