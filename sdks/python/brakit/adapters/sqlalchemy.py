"""SQLAlchemy adapter: hooks into engine events to capture queries."""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from brakit.adapters._normalize import normalize_sql
from brakit.constants.events import CHANNEL_TELEMETRY_QUERY
from brakit.constants.limits import MAX_SQL_LENGTH
from brakit.constants.logger import LOGGER_NAME
from brakit.core.context import get_request_id
from brakit.core.event_bus import EventBus
from brakit.store.query_store import QueryStore
from brakit.types.telemetry import TracedQuery

logger = logging.getLogger(LOGGER_NAME)

_CONN_KEY_START = "_brakit_start"
_CONN_KEY_SQL = "_brakit_sql"


class SQLAlchemyAdapter:
    name = "sqlalchemy"

    _patched = False
    _before_listener: Any = None
    _after_listener: Any = None

    def detect(self) -> bool:
        try:
            import sqlalchemy  # noqa: F401
            return True
        except ImportError:
            return False

    def patch(self, query_store: QueryStore, bus: EventBus) -> None:
        if SQLAlchemyAdapter._patched:
            return

        try:
            from sqlalchemy import event
            from sqlalchemy.engine import Engine
        except ImportError:
            return

        @event.listens_for(Engine, "before_cursor_execute")
        def _before(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            conn.info[_CONN_KEY_START] = time.perf_counter()
            conn.info[_CONN_KEY_SQL] = statement

        @event.listens_for(Engine, "after_cursor_execute")
        def _after(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            start: float | None = conn.info.pop(_CONN_KEY_START, None)
            sql: str = conn.info.pop(_CONN_KEY_SQL, "")

            if start is None:
                return

            duration_ms = (time.perf_counter() - start) * 1_000
            operation, table = normalize_sql(sql)

            entry = TracedQuery(
                id=uuid.uuid4().hex,
                parent_request_id=get_request_id(),
                timestamp=time.time() * 1_000,
                driver="sqlalchemy",
                sql=sql[:MAX_SQL_LENGTH] if sql else None,
                operation=operation,
                table=table,
                duration_ms=round(duration_ms, 2),
            )

            query_store.add(entry)
            bus.emit(CHANNEL_TELEMETRY_QUERY, entry)

        SQLAlchemyAdapter._before_listener = _before
        SQLAlchemyAdapter._after_listener = _after
        SQLAlchemyAdapter._patched = True

    def unpatch(self) -> None:
        if not SQLAlchemyAdapter._patched:
            return

        try:
            from sqlalchemy import event
            from sqlalchemy.engine import Engine

            if SQLAlchemyAdapter._before_listener is not None:
                event.remove(Engine, "before_cursor_execute", SQLAlchemyAdapter._before_listener)
            if SQLAlchemyAdapter._after_listener is not None:
                event.remove(Engine, "after_cursor_execute", SQLAlchemyAdapter._after_listener)
            SQLAlchemyAdapter._before_listener = None
            SQLAlchemyAdapter._after_listener = None
        except Exception:
            logger.debug("sqlalchemy unpatch failed", exc_info=True)

        SQLAlchemyAdapter._patched = False
