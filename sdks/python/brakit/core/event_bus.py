"""Publish/subscribe event bus for decoupled communication."""
from __future__ import annotations

import logging
import threading
from typing import Callable

from brakit.constants.logger import LOGGER_NAME

logger = logging.getLogger(LOGGER_NAME)


class EventBus:
    def __init__(self) -> None:
        self._listeners: dict[str, list[Callable[..., None]]] = {}
        self._lock = threading.Lock()

    def emit(self, channel: str, data: object) -> None:
        with self._lock:
            listeners = list(self._listeners.get(channel, []))

        for fn in listeners:
            try:
                fn(data)
            except Exception:
                logger.debug("event listener failed on %s", channel, exc_info=True)

    def on(self, channel: str, fn: Callable[..., None]) -> Callable[[], None]:
        with self._lock:
            if channel not in self._listeners:
                self._listeners[channel] = []
            self._listeners[channel].append(fn)

        def unsubscribe() -> None:
            with self._lock:
                listeners = self._listeners.get(channel)
                if listeners and fn in listeners:
                    listeners.remove(fn)

        return unsubscribe

    def off(self, channel: str, fn: Callable[..., None]) -> None:
        """Remove a previously registered listener."""
        with self._lock:
            listeners = self._listeners.get(channel)
            if listeners and fn in listeners:
                listeners.remove(fn)
