"""Tests for ContextVar request ID propagation."""
from __future__ import annotations

import asyncio

from brakit.core.context import clear_request_id, get_request_id, set_request_id


def test_set_and_get() -> None:
    set_request_id("abc")
    assert get_request_id() == "abc"
    clear_request_id()


def test_clear() -> None:
    set_request_id("abc")
    clear_request_id()
    assert get_request_id() is None


def test_default_is_none() -> None:
    clear_request_id()
    assert get_request_id() is None


async def test_async_task_isolation() -> None:
    """Each async task gets its own context."""
    results: dict[str, str | None] = {}

    async def task(name: str, rid: str) -> None:
        set_request_id(rid)
        await asyncio.sleep(0.01)
        results[name] = get_request_id()

    await asyncio.gather(
        task("a", "id-a"),
        task("b", "id-b"),
    )
    assert results["a"] == "id-a"
    assert results["b"] == "id-b"
