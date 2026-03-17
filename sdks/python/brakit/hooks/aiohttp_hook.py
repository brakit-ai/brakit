"""Monkey-patch aiohttp to capture outgoing HTTP requests as TracedFetch entries."""
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
from brakit.core.safe_wrap import safe_wrap_async
from brakit.hooks._shared import emit_fetch_entry

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.fetch_store import FetchStore

logger = logging.getLogger(LOGGER_NAME)

_lock = threading.Lock()
_patched = False


def patch_aiohttp(fetch_store: FetchStore, bus: EventBus) -> None:
    global _patched
    with _lock:
        if _patched:
            return
        _patched = True

    try:
        import aiohttp
    except ImportError:
        return

    original_request = aiohttp.ClientSession._request  # type: ignore[attr-defined]

    @safe_wrap_async(original_request)
    async def _patched_request(
        orig: Any, self_session: Any, method: str, url: Any, **kwargs: Any
    ) -> Any:
        url_str = str(url)
        if DASHBOARD_PREFIX in url_str:
            return await orig(self_session, method, url, **kwargs)

        request_id = get_request_id()
        fetch_id = uuid.uuid4().hex
        hdrs = kwargs.get("headers")
        if hdrs is None:
            hdrs = {}
            kwargs["headers"] = hdrs
        if isinstance(hdrs, dict):
            if request_id and BRAKIT_REQUEST_ID_HEADER not in hdrs:
                hdrs[BRAKIT_REQUEST_ID_HEADER] = request_id
            if BRAKIT_FETCH_ID_HEADER not in hdrs:
                hdrs[BRAKIT_FETCH_ID_HEADER] = fetch_id

        start = time.perf_counter()
        status_code = 0
        try:
            response = await orig(self_session, method, url, **kwargs)
            status_code = response.status
            return response
        finally:
            duration_ms = (time.perf_counter() - start) * 1_000
            emit_fetch_entry(fetch_store, bus, url_str, method,
                             status_code, duration_ms, request_id,
                             fetch_id=fetch_id)

    aiohttp.ClientSession._request = _patched_request  # type: ignore[attr-defined,assignment]
