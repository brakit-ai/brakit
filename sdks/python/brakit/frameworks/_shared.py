"""Utilities shared across all framework adapters."""
from __future__ import annotations

import time
import traceback
import uuid

from brakit.constants.headers import BRAKIT_FETCH_ID_HEADER, BRAKIT_REQUEST_ID_HEADER
from brakit.constants.patterns import STATIC_EXTENSIONS, HEALTH_CHECK_PATTERNS
from brakit.core.sanitize import sanitize_headers, sanitize_stack_trace
from brakit.types.http import TracedRequest
from brakit.types.telemetry import TracedError


def is_static(path: str) -> bool:
    """Return True if the path looks like a static asset."""
    for ext in STATIC_EXTENSIONS:
        if path.endswith(ext):
            return True
    return False


def is_health_check(path: str) -> bool:
    """Return True if the path is a health-check endpoint."""
    return any(p.search(path) for p in HEALTH_CHECK_PATTERNS)


def propagate_request_id(
    headers: dict[str, str],
) -> tuple[str, str | None, bool]:
    """Extract or generate a request ID from incoming headers.

    Returns ``(request_id, fetch_id, is_child)``.  When the brakit request-ID
    header is present the request is considered a *child* (propagated from an
    upstream service).
    """
    propagated = headers.get(BRAKIT_REQUEST_ID_HEADER)
    fetch_id = headers.get(BRAKIT_FETCH_ID_HEADER)
    rid = propagated if propagated else uuid.uuid4().hex
    is_child = propagated is not None
    return rid, fetch_id, is_child


def build_traced_request(
    *,
    rid: str,
    method: str,
    url: str,
    path: str,
    status_code: int,
    duration_ms: float,
    headers: dict[str, str],
    response_headers: dict[str, str],
    request_body: str | None,
    response_body: str | None,
    response_size: int,
) -> TracedRequest:
    """Construct a :class:`TracedRequest` with computed ``is_static`` /
    ``is_health_check`` flags.
    """
    return TracedRequest(
        id=rid,
        method=method,
        url=url,
        status_code=status_code,
        duration_ms=round(duration_ms, 2),
        timestamp=time.time() * 1_000,
        headers=sanitize_headers(headers),
        response_headers=sanitize_headers(response_headers),
        request_body=request_body,
        response_body=response_body,
        response_size=response_size,
        is_static=is_static(path),
        is_health_check=is_health_check(path),
    )


def build_traced_error(exc: Exception | BaseException, rid: str | None) -> TracedError:
    """Create a :class:`TracedError` from an exception with a sanitized stack
    trace.
    """
    return TracedError(
        id=uuid.uuid4().hex,
        parent_request_id=rid,
        timestamp=time.time() * 1_000,
        name=type(exc).__name__,
        message=str(exc),
        stack=sanitize_stack_trace(traceback.format_exc()),
    )
