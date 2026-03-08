"""Attach a handler to the root logger to capture application logs as TracedLog entries."""
from __future__ import annotations

import logging
import time
import uuid
from typing import TYPE_CHECKING

from brakit.constants.events import CHANNEL_TELEMETRY_LOG
from brakit.constants.logger import LOGGER_NAME
from brakit.core.context import get_request_id
from brakit.types.telemetry import LogLevel, TracedLog

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.log_store import LogStore

_LEVEL_MAP: dict[int, LogLevel] = {
    logging.DEBUG: "debug",
    logging.INFO: "info",
    logging.WARNING: "warning",
    logging.ERROR: "error",
    logging.CRITICAL: "critical",
}

_installed = False


class _BrakitHandler(logging.Handler):
    def __init__(self, log_store: LogStore, bus: EventBus) -> None:
        super().__init__()
        self._log_store = log_store
        self._bus = bus

    def emit(self, record: logging.LogRecord) -> None:
        # Skip our own logs to avoid infinite recursion
        if record.name.startswith(LOGGER_NAME):
            return

        try:
            level = _LEVEL_MAP.get(record.levelno, "info")
            message = self.format(record)

            entry = TracedLog(
                id=uuid.uuid4().hex,
                parent_request_id=get_request_id(),
                timestamp=time.time() * 1_000,
                level=level,
                message=message,
            )

            self._log_store.add(entry)
            self._bus.emit(CHANNEL_TELEMETRY_LOG, entry)
        except Exception:
            self.handleError(record)


def patch_logging(log_store: LogStore, bus: EventBus) -> None:
    global _installed
    if _installed:
        return

    handler = _BrakitHandler(log_store, bus)
    handler.setLevel(logging.DEBUG)
    logging.getLogger().addHandler(handler)
    _installed = True
