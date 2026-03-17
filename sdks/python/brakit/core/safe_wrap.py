"""Safety wrappers that ensure brakit never crashes the host application.

Mirrors the Node.js safeWrap pattern (src/runtime/safe-wrap.ts): the wrapper
receives ``original`` as its first argument and decides when to call it.
If the wrapper throws *at any point*, ``original`` is called with the same
arguments as a fallback — the user's code is unaffected.

Usage::

    original_send = httpx.Client.send

    @safe_wrap(original_send)
    def patched_send(original, self, request, **kw):
        inject_headers(request)          # brakit code — protected
        response = original(self, request, **kw)  # user's call
        record_telemetry(response)       # brakit code — protected
        return response

If ``inject_headers`` or ``record_telemetry`` throws, ``original_send``
is called directly. If ``original`` itself throws, that exception
propagates normally (it's the user's error, not ours).
"""
from __future__ import annotations

import functools
import logging
from typing import Any, Callable, TypeVar

from brakit.constants.logger import LOGGER_NAME

logger = logging.getLogger(LOGGER_NAME)

F = TypeVar("F", bound=Callable[..., Any])


def safe_wrap(original: Callable[..., Any]) -> Callable[[F], F]:
    """Wrap a sync monkey-patch so brakit failures fall back to *original*."""

    def decorator(fn: F) -> F:
        @functools.wraps(original)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return fn(original, *args, **kwargs)
            except Exception:
                logger.debug("safe_wrap: %s failed, falling back", fn.__qualname__, exc_info=True)
                return original(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator


def safe_wrap_async(original: Callable[..., Any]) -> Callable[[F], F]:
    """Wrap an async monkey-patch so brakit failures fall back to *original*."""

    def decorator(fn: F) -> F:
        @functools.wraps(original)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            try:
                return await fn(original, *args, **kwargs)
            except Exception:
                logger.debug(
                    "safe_wrap_async: %s failed, falling back", fn.__qualname__, exc_info=True
                )
                return await original(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
