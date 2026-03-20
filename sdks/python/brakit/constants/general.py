"""General SDK constants: encoding, headers, logger, routes, events, and patterns."""
from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Content-Encoding constants for response decompression
# ---------------------------------------------------------------------------
ENCODING_GZIP: str = "gzip"
ENCODING_DEFLATE: str = "deflate"
ENCODING_BROTLI: str = "br"

# ---------------------------------------------------------------------------
# Header and query-parameter constants for correlation and sanitization
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Logger configuration
# ---------------------------------------------------------------------------
LOGGER_NAME: str = "brakit"

# ---------------------------------------------------------------------------
# Dashboard and API route prefixes
# ---------------------------------------------------------------------------
DASHBOARD_PREFIX: str = "/__brakit"
ROUTE_INGEST: str = "/__brakit/api/ingest"

# ---------------------------------------------------------------------------
# Event bus channel names and SDK event type identifiers
# ---------------------------------------------------------------------------
CHANNEL_REQUEST_COMPLETED: str = "request:completed"
CHANNEL_TELEMETRY_FETCH: str = "telemetry:fetch"
CHANNEL_TELEMETRY_LOG: str = "telemetry:log"
CHANNEL_TELEMETRY_ERROR: str = "telemetry:error"
CHANNEL_TELEMETRY_QUERY: str = "telemetry:query"

EVENT_TYPE_REQUEST: str = "request"
EVENT_TYPE_FETCH: str = "fetch"
EVENT_TYPE_LOG: str = "log"
EVENT_TYPE_ERROR: str = "error"
EVENT_TYPE_QUERY: str = "db.query"

# ---------------------------------------------------------------------------
# Static asset and health-check detection patterns
# ---------------------------------------------------------------------------
STATIC_EXTENSIONS: tuple[str, ...] = (
    ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map",
)

HEALTH_CHECK_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^/health(z|check)?$", re.IGNORECASE),
    re.compile(r"^/ping$", re.IGNORECASE),
    re.compile(r"^/(ready|readiness|liveness)$", re.IGNORECASE),
    re.compile(r"^/status$", re.IGNORECASE),
    re.compile(r"^/__health$", re.IGNORECASE),
    re.compile(r"^/api/health(z|check)?$", re.IGNORECASE),
)
