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
    active: list[str] = []

    adapters = _get_adapters()
    for adapter in adapters:
        try:
            if adapter.detect():
                adapter.patch(query_store, bus)
                active.append(adapter.name)
        except Exception:
            logger.debug("failed to patch %s adapter", adapter.name, exc_info=True)

    return active


def _get_adapters() -> list[DBAdapter]:
    from brakit.adapters.sqlalchemy import SQLAlchemyAdapter

    return [SQLAlchemyAdapter()]
