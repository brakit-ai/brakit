"""Central service container. Created once during setup, passed to all consumers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.error_store import ErrorStore
    from brakit.store.fetch_store import FetchStore
    from brakit.store.log_store import LogStore
    from brakit.store.query_store import QueryStore
    from brakit.store.request_store import RequestStore


@dataclass
class ServiceRegistry:
    """Holds references to all brakit services for dependency injection."""

    bus: EventBus
    request_store: RequestStore
    query_store: QueryStore
    fetch_store: FetchStore
    log_store: LogStore
    error_store: ErrorStore
