"""Global exception hooks: sys.excepthook + threading.excepthook.

Captures unhandled exceptions that occur outside framework middleware
(background threads, startup code, etc.) and emits them as TracedError events.
"""
from __future__ import annotations

import sys
import threading
import time
import traceback
import uuid
from typing import Any, TYPE_CHECKING

from brakit.constants.events import CHANNEL_TELEMETRY_ERROR
from brakit.core.context import get_request_id
from brakit.core.sanitize import sanitize_stack_trace
from brakit.types.telemetry import TracedError

if TYPE_CHECKING:
    from types import TracebackType

    from brakit.core.event_bus import EventBus
    from brakit.store.error_store import ErrorStore

_lock = threading.Lock()
_installed = False
_original_excepthook = sys.excepthook
_original_threading_excepthook: Any = getattr(threading, "excepthook", None)


def patch_exceptions(error_store: ErrorStore, bus: EventBus) -> None:
    """Install global exception hooks. Idempotent."""
    global _installed
    with _lock:
        if _installed:
            return
        _installed = True

    def _brakit_excepthook(
        exc_type: type[BaseException],
        exc_value: BaseException,
        exc_tb: TracebackType | None,
    ) -> None:
        _capture(exc_type, exc_value, exc_tb, error_store, bus)
        _original_excepthook(exc_type, exc_value, exc_tb)

    def _brakit_threading_excepthook(args: Any) -> None:
        _capture(args.exc_type, args.exc_value, args.exc_traceback, error_store, bus)
        if _original_threading_excepthook is not None:
            _original_threading_excepthook(args)

    sys.excepthook = _brakit_excepthook
    threading.excepthook = _brakit_threading_excepthook  # type: ignore[attr-defined]


def _capture(
    exc_type: type[BaseException] | None,
    exc_value: BaseException | None,
    exc_tb: TracebackType | None,
    error_store: ErrorStore,
    bus: EventBus,
) -> None:
    try:
        entry = TracedError(
            id=uuid.uuid4().hex,
            parent_request_id=get_request_id(),
            timestamp=time.time() * 1_000,
            name=exc_type.__name__ if exc_type else "UnknownError",
            message=str(exc_value) if exc_value else "",
            stack=sanitize_stack_trace(
                "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
            ),
        )
        error_store.add(entry)
        bus.emit(CHANNEL_TELEMETRY_ERROR, entry)
    except Exception:
        pass  # Never let brakit crash during exception handling
