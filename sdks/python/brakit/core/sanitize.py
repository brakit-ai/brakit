"""Sanitize sensitive data from captured telemetry before forwarding."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from brakit.constants.headers import SENSITIVE_HEADER_NAMES, SENSITIVE_QUERY_PARAMS
from brakit.constants.limits import MASK_MIN_LENGTH, MASK_VISIBLE_CHARS


def _mask_value(value: str) -> str:
    """Mask a sensitive value, preserving a few chars for identification."""
    if len(value) <= MASK_MIN_LENGTH:
        return "****"
    return value[:MASK_VISIBLE_CHARS] + "..." + value[-MASK_VISIBLE_CHARS:]


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


# Matches connection strings with embedded credentials: proto://user:pass@host
_CONN_STRING_RE = re.compile(r"(\w+://)[^:]+:[^@]+@")


def sanitize_stack_trace(trace: str) -> str:
    """Remove embedded credentials from connection strings in stack traces.

    Replaces ``user:password`` in database URLs while preserving the overall
    stack-trace structure for debugging.
    """
    return _CONN_STRING_RE.sub(r"\1****:****@", trace)
