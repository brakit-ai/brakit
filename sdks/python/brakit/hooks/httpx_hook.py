"""Monkey-patch httpx to capture outgoing HTTP requests as TracedFetch entries."""
from __future__ import annotations

import logging
import threading
import time
import uuid
from typing import Any, TYPE_CHECKING

from brakit.constants.headers import BRAKIT_FETCH_ID_HEADER, BRAKIT_REQUEST_ID_HEADER
from brakit.constants.logger import LOGGER_NAME
from brakit.constants.routes import DASHBOARD_PREFIX
from brakit.core.context import get_request_id
from brakit.core.safe_wrap import safe_wrap, safe_wrap_async
from brakit.hooks._shared import emit_fetch_entry

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.fetch_store import FetchStore

logger = logging.getLogger(LOGGER_NAME)

_lock = threading.Lock()
_patched = False


def patch_httpx(fetch_store: FetchStore, bus: EventBus) -> None:
    global _patched
    with _lock:
        if _patched:
            return
        _patched = True

    try:
        import httpx
    except ImportError:
        return

    original_send = httpx.Client.send
    original_async_send = httpx.AsyncClient.send

    def _prepare(request: Any) -> tuple[str, str | None, str] | None:
        """Inject trace headers. Return (url, request_id, fetch_id) or None to skip."""
        url_str = str(request.url)
        if DASHBOARD_PREFIX in url_str:
            return None
        request_id = get_request_id()
        fetch_id = uuid.uuid4().hex
        if request_id and BRAKIT_REQUEST_ID_HEADER not in request.headers:
            request.headers[BRAKIT_REQUEST_ID_HEADER] = request_id
        if BRAKIT_FETCH_ID_HEADER not in request.headers:
            request.headers[BRAKIT_FETCH_ID_HEADER] = fetch_id
        return url_str, request_id, fetch_id

    def _record(url_str: str, method: str, status_code: int,
                start: float, request_id: str | None, fetch_id: str) -> None:
        duration_ms = (time.perf_counter() - start) * 1_000
        emit_fetch_entry(fetch_store, bus, url_str, method,
                         status_code, duration_ms, request_id,
                         fetch_id=fetch_id)

    @safe_wrap(original_send)
    def _patched_send(orig: Any, self_client: Any, request: Any, **kwargs: Any) -> Any:
        ctx = _prepare(request)
        if ctx is None:
            return orig(self_client, request, **kwargs)
        url_str, request_id, fetch_id = ctx
        start = time.perf_counter()
        status_code = 0
        try:
            response = orig(self_client, request, **kwargs)
            status_code = response.status_code
            return response
        finally:
            _record(url_str, str(request.method), status_code, start, request_id, fetch_id)

    @safe_wrap_async(original_async_send)
    async def _patched_async_send(orig: Any, self_client: Any, request: Any, **kwargs: Any) -> Any:
        ctx = _prepare(request)
        if ctx is None:
            return await orig(self_client, request, **kwargs)
        url_str, request_id, fetch_id = ctx
        start = time.perf_counter()
        status_code = 0
        try:
            response = await orig(self_client, request, **kwargs)
            status_code = response.status_code
            return response
        finally:
            _record(url_str, str(request.method), status_code, start, request_id, fetch_id)

    httpx.Client.send = _patched_send  # type: ignore[assignment]
    httpx.AsyncClient.send = _patched_async_send  # type: ignore[assignment]
