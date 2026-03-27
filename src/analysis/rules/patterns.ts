// ── Set-based exact-match lookups (replace regex for simple word lists) ──

const SECRET_KEY_SET = new Set([
  "password", "passwd", "secret", "api_key", "apiKey",
  "api_secret", "apiSecret", "private_key", "privateKey",
  "client_secret", "clientSecret",
]);
/** Matches exact secret key names. */
export const SECRET_KEYS = { test: (s: string) => SECRET_KEY_SET.has(s) };

const TOKEN_PARAM_SET = new Set([
  "token", "api_key", "apiKey", "secret", "password",
  "access_token", "session_id", "sessionId",
]);
export const TOKEN_PARAMS = { test: (s: string) => TOKEN_PARAM_SET.has(s) };

const SAFE_PARAM_SET = new Set([
  "_rsc", "__clerk_handshake", "__clerk_db_jwt", "callback", "code",
  "state", "nonce", "redirect_uri", "utm_", "fbclid", "gclid",
]);
export const SAFE_PARAMS = { test: (s: string) => SAFE_PARAM_SET.has(s) };

const INTERNAL_ID_KEY_SET = new Set([
  "id", "_id", "userId", "user_id", "createdBy", "updatedBy",
  "organizationId", "org_id", "tenantId", "tenant_id",
]);
export const INTERNAL_ID_KEYS = { test: (s: string) => INTERNAL_ID_KEY_SET.has(s) };

export const INTERNAL_ID_SUFFIX = {
  test: (s: string) => s.endsWith("Id") || s.endsWith("_id"),
};

const SENSITIVE_FIELD_SET = new Set([
  "phone", "phonenumber", "phone_number", "ssn",
  "socialsecuritynumber", "social_security_number",
  "dateofbirth", "date_of_birth", "dob",
  "address", "streetaddress", "street_address",
  "creditcard", "credit_card", "cardnumber", "card_number",
  "bankaccount", "bank_account",
  "passport", "passportnumber", "passport_number",
  "nationalid", "national_id",
]);
/** Case-insensitive match against sensitive PII field names. */
export const SENSITIVE_FIELD_NAMES = {
  test: (s: string) => SENSITIVE_FIELD_SET.has(s.toLowerCase()),
};

// ── String-method-based checks (replace regex for simple prefix/suffix/contains) ──

const SELF_SERVICE_SEGMENTS = new Set(["me", "account", "profile", "settings", "self"]);
/**
 * Path segments that indicate the response is the authenticated user's own
 * data (self-service). These endpoints legitimately return personal fields,
 * so PII detection is suppressed to avoid false positives.
 */
export const SELF_SERVICE_PATH = {
  test: (path: string) => {
    const segments = path.toLowerCase().split(/[/?#]/);
    return segments.some((seg) => SELF_SERVICE_SEGMENTS.has(seg));
  },
};

const MASKED_LITERALS = ["[REDACTED]", "[FILTERED]", "CHANGE_ME"];
export const MASKED_RE = {
  test: (s: string) => {
    const upper = s.toUpperCase();
    if (MASKED_LITERALS.some((m) => upper.includes(m))) return true;
    // All asterisks (e.g. "****")
    if (s.length > 0 && s.split("").every((c) => c === "*")) return true;
    // Three or more x's (e.g. "xxx", "xxxx")
    if (s.length >= 3 && s.split("").every((c) => c === "x" || c === "X")) return true;
    return false;
  },
};

const DB_PROTOCOLS = ["postgres://", "mysql://", "mongodb://", "redis://"];
export const DB_CONN_RE = {
  test: (s: string) => DB_PROTOCOLS.some((p) => s.includes(p)),
};

export const SELECT_STAR_RE = {
  test: (s: string) => {
    const t = s.trimStart().toUpperCase();
    return t.startsWith("SELECT *") || t.startsWith("SELECT\t*");
  },
};

export const SELECT_DOT_STAR_RE = {
  test: (s: string) => s.toUpperCase().includes(".* FROM"),
};

// ── Regex kept where genuinely needed (structural patterns, captures, boundaries) ──

/** Stack trace detection — needs regex for line:col patterns across JS/Python formats. */
export const STACK_TRACE_RE = /at\s+.+\(.+:\d+:\d+\)|at\s+Module\._compile|at\s+Object\.<anonymous>|at\s+processTicksAndRejections|Traceback \(most recent call last\)|File ".+", line \d+/;

/** SQL fragments — needs regex for word boundaries and flexible whitespace. */
export const SQL_FRAGMENT_RE = /\b(SELECT\s+[\w.*]+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;

/** Secret values in format `key[:=] value` — needs regex for structural matching. */
export const SECRET_VAL_RE = /(api_key|apiKey|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_\-.+/]{8,}/;

/** Secret values in logs — same pattern, case-insensitive. */
export const LOG_SECRET_RE = /(password|secret|token|api_key|apiKey)\s*[:=]\s*["']?[A-Za-z0-9_\-.+/]{8,}/i;

/** Email addresses — standard email pattern, regex is the right tool here. */
export const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export const RULE_HINTS: Record<string, string> = {
  "exposed-secret": "Never include secret fields in API responses. Strip sensitive fields before returning.",
  "token-in-url": "Pass tokens in the Authorization header, not URL query parameters.",
  "stack-trace-leak": "Use a custom error handler that returns generic messages in production.",
  "error-info-leak": "Sanitize error responses. Return generic messages instead of internal details.",
  "insecure-cookie": "Set HttpOnly and SameSite flags on all cookies.",
  "sensitive-logs": "Redact PII before logging. Never log passwords or tokens.",
  "cors-credentials": "Cannot use credentials:true with origin:*. Specify explicit origins.",
  "response-pii-leak": "API responses should return minimal data. Don't echo back full user records — select only the fields the client needs.",
};
