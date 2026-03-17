"""asyncpg adapter: monkey-patches Pool methods to capture query telemetry."""
from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Callable, Coroutine
from typing import Any

from brakit.adapters._normalize import is_noise_query, normalize_sql
from brakit.constants.events import CHANNEL_TELEMETRY_QUERY
from brakit.constants.limits import MAX_SQL_LENGTH
from brakit.constants.logger import LOGGER_NAME
from brakit.core.context import get_fetch_id, get_request_id
from brakit.core.event_bus import EventBus
from brakit.store.query_store import QueryStore
from brakit.types.telemetry import TracedQuery

logger = logging.getLogger(LOGGER_NAME)

# All asyncpg methods that accept a SQL string as their first positional
# argument. Connection.prepare() is excluded because it does not execute
# immediately.
_POOL_METHODS = ("fetch", "fetchrow", "fetchval", "execute")
_CONN_METHODS = ("fetch", "fetchrow", "fetchval", "execute")


class AsyncpgAdapter:
    name = "asyncpg"

    _patched = False
    _originals_pool: dict[str, Any] = {}
    _originals_conn: dict[str, Any] = {}

    def detect(self) -> bool:
        try:
            import asyncpg  # noqa: F401
            return True
        except ImportError:
            return False

    def patch(self, query_store: QueryStore, bus: EventBus) -> None:
        if AsyncpgAdapter._patched:
            return

        try:
            import asyncpg.pool
            import asyncpg.connection
        except ImportError:
            return

        pool_cls = asyncpg.pool.Pool
        conn_cls = asyncpg.connection.Connection

        for method_name in _POOL_METHODS:
            original = getattr(pool_cls, method_name, None)
            if original is None:
                continue
            AsyncpgAdapter._originals_pool[method_name] = original
            wrapped = _make_wrapper(original, query_store, bus)
            setattr(pool_cls, method_name, wrapped)

        for method_name in _CONN_METHODS:
            original = getattr(conn_cls, method_name, None)
            if original is None:
                continue
            AsyncpgAdapter._originals_conn[method_name] = original
            wrapped = _make_wrapper(original, query_store, bus)
            setattr(conn_cls, method_name, wrapped)

        AsyncpgAdapter._patched = True

    def unpatch(self) -> None:
        if not AsyncpgAdapter._patched:
            return

        try:
            import asyncpg.pool
            import asyncpg.connection

            for method_name, original in AsyncpgAdapter._originals_pool.items():
                setattr(asyncpg.pool.Pool, method_name, original)
            for method_name, original in AsyncpgAdapter._originals_conn.items():
                setattr(asyncpg.connection.Connection, method_name, original)
            AsyncpgAdapter._originals_pool.clear()
            AsyncpgAdapter._originals_conn.clear()
        except Exception:
            logger.debug("asyncpg unpatch failed", exc_info=True)

        AsyncpgAdapter._patched = False


def _make_wrapper(
    original: Callable[..., Coroutine[Any, Any, Any]],
    query_store: QueryStore,
    bus: EventBus,
) -> Callable[..., Coroutine[Any, Any, Any]]:
    async def wrapper(self: Any, query: str, *args: Any, **kwargs: Any) -> Any:
        # Skip telemetry for queries outside a request context (connection setup)
        # or known asyncpg internal queries.
        request_id = get_request_id()
        should_capture = request_id is not None and not is_noise_query(query)

        if not should_capture:
            return await original(self, query, *args, **kwargs)

        start = time.perf_counter()
        try:
            result = await original(self, query, *args, **kwargs)
            return result
        finally:
            duration_ms = (time.perf_counter() - start) * 1_000
            try:
                operation, table = normalize_sql(query)
                entry = TracedQuery(
                    id=uuid.uuid4().hex,
                    parent_request_id=request_id,
                    timestamp=time.time() * 1_000,
                    driver="asyncpg",
                    sql=query[:MAX_SQL_LENGTH] if query else None,
                    operation=operation,
                    table=table,
                    duration_ms=round(duration_ms, 2),
                    parent_fetch_id=get_fetch_id(),
                )
                query_store.add(entry)
                bus.emit(CHANNEL_TELEMETRY_QUERY, entry)
            except Exception:
                logger.debug("asyncpg telemetry capture failed", exc_info=True)

    return wrapper
