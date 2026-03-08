"""Monkey-patch hooks for logging and outgoing HTTP requests."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from brakit.constants.logger import LOGGER_NAME

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.fetch_store import FetchStore
    from brakit.store.log_store import LogStore

logger = logging.getLogger(LOGGER_NAME)


def patch_all(
    log_store: LogStore,
    fetch_store: FetchStore,
    bus: EventBus,
) -> None:
    from brakit.hooks.logging import patch_logging
    from brakit.hooks.http_client import patch_http_client

    try:
        patch_logging(log_store, bus)
    except Exception:
        logger.debug("failed to patch logging", exc_info=True)

    try:
        patch_http_client(fetch_store, bus)
    except Exception:
        logger.debug("failed to patch http client", exc_info=True)
