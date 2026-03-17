"""Monkey-patch urllib3 to capture outgoing HTTP requests as TracedFetch entries."""
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
from brakit.core.safe_wrap import safe_wrap
from brakit.hooks._shared import emit_fetch_entry

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.fetch_store import FetchStore

logger = logging.getLogger(LOGGER_NAME)

_lock = threading.Lock()
_patched = False


def patch_http_client(fetch_store: FetchStore, bus: EventBus) -> None:
    global _patched
    with _lock:
        if _patched:
            return
        _patched = True

    try:
        import urllib3
    except ImportError:
        return

    original_urlopen = urllib3.HTTPConnectionPool.urlopen

    @safe_wrap(original_urlopen)
    def _patched_urlopen(orig: Any, self: Any, method: str, url: str, *args: Any, **kwargs: Any) -> Any:
        if DASHBOARD_PREFIX in url:
            return orig(self, method, url, *args, **kwargs)

        full_url = f"{self.scheme}://{self.host}:{self.port}{url}"
        request_id = get_request_id()
        fetch_id = uuid.uuid4().hex
        start = time.perf_counter()

        headers = kwargs.get("headers")
        if headers is None:
            headers = {}
            kwargs["headers"] = headers
        if isinstance(headers, dict):
            if request_id and BRAKIT_REQUEST_ID_HEADER not in headers:
                headers[BRAKIT_REQUEST_ID_HEADER] = request_id
            if BRAKIT_FETCH_ID_HEADER not in headers:
                headers[BRAKIT_FETCH_ID_HEADER] = fetch_id

        try:
            response = orig(self, method, url, *args, **kwargs)
            status_code = response.status
        except Exception:
            status_code = 0
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1_000
            emit_fetch_entry(fetch_store, bus, full_url, method,
                             status_code, duration_ms, request_id,
                             fetch_id=fetch_id)

        return response

    urllib3.HTTPConnectionPool.urlopen = _patched_urlopen  # type: ignore[assignment]
