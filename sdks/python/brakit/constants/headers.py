"""Header and query-parameter constants for correlation and sanitization."""

BRAKIT_REQUEST_ID_HEADER = "x-brakit-request-id"
BRAKIT_FETCH_ID_HEADER = "x-brakit-fetch-id"

SENSITIVE_HEADER_NAMES: frozenset[str] = frozenset({
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "x-api-key",
    "x-auth-token",
})

SENSITIVE_QUERY_PARAMS: frozenset[str] = frozenset({
    "token",
    "key",
    "secret",
    "password",
    "api_key",
    "apikey",
    "access_token",
    "auth",
})
