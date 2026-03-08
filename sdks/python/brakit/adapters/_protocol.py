"""Protocol definition for database adapters."""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from brakit.core.event_bus import EventBus
from brakit.store.query_store import QueryStore


@runtime_checkable
class DBAdapter(Protocol):
    name: str

    def detect(self) -> bool: ...
    def patch(self, query_store: QueryStore, bus: EventBus) -> None: ...
    def unpatch(self) -> None: ...
