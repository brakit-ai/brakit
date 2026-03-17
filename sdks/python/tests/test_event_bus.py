"""Tests for EventBus pub/sub."""
from __future__ import annotations

import threading

from brakit.core.event_bus import EventBus


def test_emit_calls_listener() -> None:
    bus = EventBus()
    received: list[object] = []
    bus.on("ch", received.append)
    bus.emit("ch", "hello")
    assert received == ["hello"]


def test_multiple_listeners() -> None:
    bus = EventBus()
    a: list[object] = []
    b: list[object] = []
    bus.on("ch", a.append)
    bus.on("ch", b.append)
    bus.emit("ch", 42)
    assert a == [42]
    assert b == [42]


def test_off_removes_listener() -> None:
    bus = EventBus()
    received: list[object] = []
    bus.on("ch", received.append)
    bus.off("ch", received.append)
    bus.emit("ch", "x")
    assert received == []


def test_on_returns_unsubscribe() -> None:
    bus = EventBus()
    received: list[object] = []
    unsub = bus.on("ch", received.append)
    unsub()
    bus.emit("ch", "x")
    assert received == []


def test_listener_exception_swallowed() -> None:
    bus = EventBus()
    calls: list[str] = []

    def bad(_: object) -> None:
        raise RuntimeError("boom")

    def good(data: object) -> None:
        calls.append("ok")

    bus.on("ch", bad)
    bus.on("ch", good)
    bus.emit("ch", None)
    assert calls == ["ok"]


def test_emit_no_listeners() -> None:
    bus = EventBus()
    bus.emit("nonexistent", "data")  # should not raise


def test_thread_safety() -> None:
    bus = EventBus()
    received: list[object] = []
    bus.on("ch", received.append)

    def emit_from_thread() -> None:
        for i in range(100):
            bus.emit("ch", i)

    threads = [threading.Thread(target=emit_from_thread) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(received) == 400
