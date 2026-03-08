"""Generic ring-buffer store with pub/sub listener support."""
from __future__ import annotations

import logging
import threading
from collections import deque
from typing import Callable, Generic, TypeVar

from brakit.constants.limits import MAX_STORE_ENTRIES
from brakit.constants.logger import LOGGER_NAME

logger = logging.getLogger(LOGGER_NAME)

T = TypeVar("T")


class TelemetryStore(Generic[T]):
    def __init__(self, max_entries: int = MAX_STORE_ENTRIES) -> None:
        self._entries: deque[T] = deque(maxlen=max_entries)
        self._listeners: list[Callable[[T], None]] = []
        self._lock = threading.Lock()

    def add(self, entry: T) -> None:
        with self._lock:
            self._entries.append(entry)

        for fn in self._listeners:
            try:
                fn(entry)
            except Exception:
                logger.debug("store listener failed", exc_info=True)

    def get_all(self) -> list[T]:
        with self._lock:
            return list(self._entries)

    def get_by_request(self, request_id: str) -> list[T]:
        with self._lock:
            return [
                e for e in self._entries
                if getattr(e, "parent_request_id", None) == request_id
            ]

    def on_entry(self, fn: Callable[[T], None]) -> Callable[[], None]:
        """Subscribe to new entries. Returns an unsubscribe callable."""
        self._listeners.append(fn)

        def unsubscribe() -> None:
            try:
                self._listeners.remove(fn)
            except ValueError:
                pass

        return unsubscribe

    def off_entry(self, fn: Callable[[T], None]) -> None:
        """Remove a previously registered listener."""
        try:
            self._listeners.remove(fn)
        except ValueError:
            pass

    # Backward-compat alias
    on_add = on_entry

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
