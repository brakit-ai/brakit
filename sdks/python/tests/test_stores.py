"""Tests for TelemetryStore ring buffer and all store variants."""
from __future__ import annotations

import time

from brakit.store.fetch_store import FetchStore
from brakit.store.log_store import LogStore
from brakit.store.request_store import RequestStore
from brakit.types.http import TracedRequest
from brakit.types.telemetry import TracedFetch, TracedLog


def _make_fetch(parent_id: str | None = None) -> TracedFetch:
    return TracedFetch(
        id="f1",
        parent_request_id=parent_id,
        timestamp=time.time() * 1_000,
        url="http://example.com",
        method="GET",
        status_code=200,
        duration_ms=10.0,
    )


def _make_request(rid: str = "r1") -> TracedRequest:
    return TracedRequest(
        id=rid,
        method="GET",
        url="/test",
        status_code=200,
        duration_ms=5.0,
        timestamp=time.time() * 1_000,
        headers={},
        response_headers={},
        request_body=None,
        response_body=None,
        response_size=0,
        is_static=False,
    )


def test_add_and_get_all() -> None:
    store = FetchStore()
    entry = _make_fetch()
    store.add(entry)
    assert store.get_all() == [entry]


def test_get_by_request() -> None:
    store = FetchStore()
    a = TracedFetch(id="a", parent_request_id="req1", timestamp=0, url="", method="GET",
                    status_code=200, duration_ms=0)
    b = TracedFetch(id="b", parent_request_id="req2", timestamp=0, url="", method="GET",
                    status_code=200, duration_ms=0)
    store.add(a)
    store.add(b)
    assert store.get_by_request("req1") == [a]
    assert store.get_by_request("req2") == [b]


def test_get_by_request_unknown_id() -> None:
    store = FetchStore()
    assert store.get_by_request("nonexistent") == []


def test_clear() -> None:
    store = FetchStore()
    store.add(_make_fetch())
    store.clear()
    assert store.get_all() == []


def test_ring_buffer_eviction() -> None:
    store = FetchStore(max_entries=3)
    for i in range(5):
        store.add(TracedFetch(id=str(i), parent_request_id=None, timestamp=0, url="",
                              method="GET", status_code=200, duration_ms=0))
    all_entries = store.get_all()
    assert len(all_entries) == 3
    assert [e.id for e in all_entries] == ["2", "3", "4"]


def test_listener_on_add() -> None:
    store = FetchStore()
    received: list[TracedFetch] = []
    store.on_entry(received.append)
    entry = _make_fetch()
    store.add(entry)
    assert received == [entry]


def test_listener_removal() -> None:
    store = FetchStore()
    received: list[TracedFetch] = []
    unsub = store.on_entry(received.append)
    unsub()
    store.add(_make_fetch())
    assert received == []


def test_request_store_get_by_id() -> None:
    store = RequestStore()
    req = _make_request("r1")
    store.add(req)
    assert store.get_by_id("r1") == req
    assert store.get_by_id("nonexistent") is None


def test_log_store_basic() -> None:
    store = LogStore()
    entry = TracedLog(id="l1", parent_request_id=None, timestamp=0, level="info", message="test")
    store.add(entry)
    assert store.get_all() == [entry]
