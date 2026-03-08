"""Store for traced HTTP requests."""
from __future__ import annotations

from typing import Callable

from brakit.store.base import TelemetryStore
from brakit.types.http import TracedRequest


class RequestStore(TelemetryStore[TracedRequest]):
    def get_by_id(self, request_id: str) -> TracedRequest | None:
        with self._lock:
            for entry in self._entries:
                if entry.id == request_id:
                    return entry
        return None

    def on_request(self, fn: Callable[[TracedRequest], None]) -> None:
        """Alias for on_add (backward compat)."""
        self.on_add(fn)
