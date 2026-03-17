"""Shared fixtures for brakit tests."""
from __future__ import annotations

import pytest

from brakit.core.event_bus import EventBus
from brakit.core.registry import ServiceRegistry
from brakit.store.error_store import ErrorStore
from brakit.store.fetch_store import FetchStore
from brakit.store.log_store import LogStore
from brakit.store.query_store import QueryStore
from brakit.store.request_store import RequestStore


@pytest.fixture
def bus() -> EventBus:
    return EventBus()


@pytest.fixture
def request_store() -> RequestStore:
    return RequestStore()


@pytest.fixture
def query_store() -> QueryStore:
    return QueryStore()


@pytest.fixture
def fetch_store() -> FetchStore:
    return FetchStore()


@pytest.fixture
def log_store() -> LogStore:
    return LogStore()


@pytest.fixture
def error_store() -> ErrorStore:
    return ErrorStore()


@pytest.fixture
def registry(
    bus: EventBus,
    request_store: RequestStore,
    query_store: QueryStore,
    fetch_store: FetchStore,
    log_store: LogStore,
    error_store: ErrorStore,
) -> ServiceRegistry:
    return ServiceRegistry(
        bus=bus,
        request_store=request_store,
        query_store=query_store,
        fetch_store=fetch_store,
        log_store=log_store,
        error_store=error_store,
    )
