"""ContextVar-based request-ID propagation for async-safe tracing."""
from __future__ import annotations

from contextvars import ContextVar

_request_id: ContextVar[str | None] = ContextVar("brakit_request_id", default=None)


def set_request_id(rid: str) -> None:
    _request_id.set(rid)


def get_request_id() -> str | None:
    return _request_id.get()


def clear_request_id() -> None:
    _request_id.set(None)
