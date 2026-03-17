"""Monkey-patch hooks for logging, outgoing HTTP requests, and global exceptions."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from brakit.constants.logger import LOGGER_NAME

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.error_store import ErrorStore
    from brakit.store.fetch_store import FetchStore
    from brakit.store.log_store import LogStore

logger = logging.getLogger(LOGGER_NAME)


def patch_all(
    log_store: LogStore,
    fetch_store: FetchStore,
    error_store: ErrorStore,
    bus: EventBus,
) -> None:
    from brakit.hooks.logging import patch_logging
    from brakit.hooks.http_client import patch_http_client
    from brakit.hooks.httpx_hook import patch_httpx
    from brakit.hooks.aiohttp_hook import patch_aiohttp
    from brakit.hooks.exceptions import patch_exceptions

    try:
        patch_logging(log_store, bus)
    except Exception:
        logger.debug("failed to patch logging", exc_info=True)

    try:
        patch_http_client(fetch_store, bus)
    except Exception:
        logger.debug("failed to patch http client", exc_info=True)

    try:
        patch_httpx(fetch_store, bus)
    except Exception:
        logger.debug("failed to patch httpx", exc_info=True)

    try:
        patch_aiohttp(fetch_store, bus)
    except Exception:
        logger.debug("failed to patch aiohttp", exc_info=True)

    try:
        patch_exceptions(error_store, bus)
    except Exception:
        logger.debug("failed to patch exceptions", exc_info=True)
