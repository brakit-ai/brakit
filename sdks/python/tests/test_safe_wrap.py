"""Tests for safe_wrap decorator — mirrors Node.js safeWrap (src/runtime/safe-wrap.ts)."""
from __future__ import annotations

from brakit.core.safe_wrap import safe_wrap, safe_wrap_async


def test_successful_call_passes_through() -> None:
    def original(x: int) -> int:
        return x * 2

    @safe_wrap(original)
    def wrapped(orig: object, x: int) -> int:
        return x * 3

    assert wrapped(5) == 15


def test_exception_falls_back_to_original() -> None:
    def original(x: int) -> int:
        return x * 2

    @safe_wrap(original)
    def wrapped(orig: object, x: int) -> int:
        raise RuntimeError("brakit bug")

    assert wrapped(5) == 10


def test_original_exception_propagates() -> None:
    """If the wrapper calls original and original throws, that propagates (not swallowed)."""
    def original(x: int) -> int:
        raise ValueError("user error")

    @safe_wrap(original)
    def wrapped(orig: object, x: int) -> int:
        return orig(x)  # type: ignore[operator]

    try:
        wrapped(5)
        assert False, "should have raised"
    except ValueError as exc:
        assert str(exc) == "user error"


def test_preserves_function_name() -> None:
    def original() -> None:
        pass

    @safe_wrap(original)
    def my_func(orig: object) -> None:
        pass

    assert my_func.__name__ == "original"


async def test_async_successful() -> None:
    async def original(x: int) -> int:
        return x * 2

    @safe_wrap_async(original)
    async def wrapped(orig: object, x: int) -> int:
        return x * 3

    assert await wrapped(5) == 15


async def test_async_fallback() -> None:
    async def original(x: int) -> int:
        return x * 2

    @safe_wrap_async(original)
    async def wrapped(orig: object, x: int) -> int:
        raise RuntimeError("brakit bug")

    assert await wrapped(5) == 10
