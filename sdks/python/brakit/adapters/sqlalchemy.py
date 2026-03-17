"""SQLAlchemy adapter: hooks into engine events to capture queries."""
from __future__ import annotations

import logging
import time
import uuid
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

_SA_INFO_START_TIME = "_brakit_start"
_SA_INFO_SQL = "_brakit_sql"


class SQLAlchemyAdapter:
    name = "sqlalchemy"

    _patched = False
    _on_before_listener: Any = None
    _on_after_listener: Any = None

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
        def _on_before_execute(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            conn.info[_SA_INFO_START_TIME] = time.perf_counter()
            conn.info[_SA_INFO_SQL] = statement

        @event.listens_for(Engine, "after_cursor_execute")
        def _on_after_execute(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            start: float | None = conn.info.pop(_SA_INFO_START_TIME, None)
            sql: str = conn.info.pop(_SA_INFO_SQL, "")

            if start is None:
                return

            request_id = get_request_id()
            if request_id is None:
                return

            if is_noise_query(sql):
                return

            duration_ms = (time.perf_counter() - start) * 1_000
            operation, table = normalize_sql(sql)

            entry = TracedQuery(
                id=uuid.uuid4().hex,
                parent_request_id=request_id,
                timestamp=time.time() * 1_000,
                driver="sqlalchemy",
                sql=sql[:MAX_SQL_LENGTH] if sql else None,
                operation=operation,
                table=table,
                duration_ms=round(duration_ms, 2),
                parent_fetch_id=get_fetch_id(),
            )

            query_store.add(entry)
            bus.emit(CHANNEL_TELEMETRY_QUERY, entry)

        SQLAlchemyAdapter._on_before_listener = _on_before_execute
        SQLAlchemyAdapter._on_after_listener = _on_after_execute
        SQLAlchemyAdapter._patched = True

    def unpatch(self) -> None:
        if not SQLAlchemyAdapter._patched:
            return

        try:
            from sqlalchemy import event
            from sqlalchemy.engine import Engine

            if SQLAlchemyAdapter._on_before_listener is not None:
                event.remove(Engine, "before_cursor_execute", SQLAlchemyAdapter._on_before_listener)
            if SQLAlchemyAdapter._on_after_listener is not None:
                event.remove(Engine, "after_cursor_execute", SQLAlchemyAdapter._on_after_listener)
            SQLAlchemyAdapter._on_before_listener = None
            SQLAlchemyAdapter._on_after_listener = None
        except Exception:
            logger.debug("sqlalchemy unpatch failed", exc_info=True)

        SQLAlchemyAdapter._patched = False
