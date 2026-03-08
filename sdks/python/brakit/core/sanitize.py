"""Sanitize sensitive data from captured telemetry before forwarding."""
from __future__ import annotations

from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

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

_MASK_MIN_LENGTH = 8
_MASK_VISIBLE_CHARS = 4


def _mask_value(value: str) -> str:
    if len(value) <= _MASK_MIN_LENGTH:
        return "****"
    v = _MASK_VISIBLE_CHARS
    return value[:v] + "..." + value[-v:]


def sanitize_headers(headers: dict[str, str]) -> dict[str, str]:
    """Mask values of sensitive headers (Authorization, Cookie, etc.)."""
    sanitized: dict[str, str] = {}
    for key, value in headers.items():
        if key.lower() in SENSITIVE_HEADER_NAMES:
            sanitized[key] = _mask_value(value)
        else:
            sanitized[key] = value
    return sanitized


def sanitize_url(url: str) -> str:
    """Mask query parameter values that look like secrets."""
    parts = urlsplit(url)
    if not parts.query:
        return url

    params = parse_qs(parts.query, keep_blank_values=True)
    changed = False
    for param_name in params:
        if param_name.lower() in SENSITIVE_QUERY_PARAMS:
            params[param_name] = ["****"]
            changed = True

    if not changed:
        return url

    new_query = urlencode(params, doseq=True)
    return urlunsplit(parts._replace(query=new_query))
