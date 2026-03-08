"""Monkey-patch urllib3 to capture outgoing HTTP requests as TracedFetch entries."""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, TYPE_CHECKING

from brakit.constants.events import CHANNEL_TELEMETRY_FETCH
from brakit.constants.logger import LOGGER_NAME
from brakit.constants.routes import DASHBOARD_PREFIX
from brakit.core.context import get_request_id
from brakit.core.sanitize import sanitize_url
from brakit.types.telemetry import TracedFetch

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.fetch_store import FetchStore

logger = logging.getLogger(LOGGER_NAME)

_patched = False


def patch_http_client(fetch_store: FetchStore, bus: EventBus) -> None:
    global _patched
    if _patched:
        return

    try:
        import urllib3
    except ImportError:
        return

    original_urlopen = urllib3.HTTPConnectionPool.urlopen

    def _patched_urlopen(
        self: Any,
        method: str,
        url: str,
        body: Any = None,
        headers: Any = None,
        retries: Any = None,
        redirect: bool = True,
        assert_same_host: bool = True,
        timeout: Any = None,
        pool_connections: Any = None,
        pool_maxsize: Any = None,
        **kw: Any,
    ) -> Any:
        if DASHBOARD_PREFIX in url:
            return original_urlopen(
                self, method, url, body=body, headers=headers,
                retries=retries, redirect=redirect,
                assert_same_host=assert_same_host, timeout=timeout,
                **kw,
            )

        full_url = sanitize_url(f"{self.scheme}://{self.host}:{self.port}{url}")
        request_id = get_request_id()
        start = time.perf_counter()

        try:
            response = original_urlopen(
                self, method, url, body=body, headers=headers,
                retries=retries, redirect=redirect,
                assert_same_host=assert_same_host, timeout=timeout,
                **kw,
            )
            status_code = response.status
        except Exception:
            status_code = 0
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1_000
            entry = TracedFetch(
                id=uuid.uuid4().hex,
                parent_request_id=request_id,
                timestamp=time.time() * 1_000,
                url=full_url,
                method=method.upper(),
                status_code=status_code,
                duration_ms=round(duration_ms, 2),
            )
            try:
                fetch_store.add(entry)
                bus.emit(CHANNEL_TELEMETRY_FETCH, entry)
            except Exception:
                logger.debug("failed to record fetch", exc_info=True)

        return response

    urllib3.HTTPConnectionPool.urlopen = _patched_urlopen  # type: ignore[assignment]
    _patched = True
