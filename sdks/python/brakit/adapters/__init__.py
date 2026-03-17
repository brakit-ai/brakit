"""Detect and patch database adapters (SQLAlchemy, etc.)."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from brakit.constants.logger import LOGGER_NAME

if TYPE_CHECKING:
    from brakit.adapters._protocol import DBAdapter
    from brakit.core.event_bus import EventBus
    from brakit.store import QueryStore

logger = logging.getLogger(LOGGER_NAME)


def detect_and_patch(
    query_store: QueryStore,
    bus: EventBus,
) -> list[str]:
    from brakit.adapters.asyncpg import AsyncpgAdapter
    from brakit.adapters.sqlalchemy import SQLAlchemyAdapter

    active: list[str] = []

    # SQLAlchemy hooks into engine events and captures all queries including
    # those routed through asyncpg.  If both are present, only use SQLAlchemy
    # to avoid double-capturing.
    sa = SQLAlchemyAdapter()
    if sa.detect():
        try:
            sa.patch(query_store, bus)
            active.append(sa.name)
        except Exception:
            logger.debug("failed to patch %s adapter", sa.name, exc_info=True)
    else:
        # No SQLAlchemy — try raw asyncpg.
        apg = AsyncpgAdapter()
        if apg.detect():
            try:
                apg.patch(query_store, bus)
                active.append(apg.name)
            except Exception:
                logger.debug("failed to patch %s adapter", apg.name, exc_info=True)

    return active
