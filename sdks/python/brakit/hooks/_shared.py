"""Shared helpers for HTTP client hooks."""
from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING

from brakit.constants.events import CHANNEL_TELEMETRY_FETCH
from brakit.core.sanitize import sanitize_url
from brakit.types.telemetry import TracedFetch

if TYPE_CHECKING:
    from brakit.core.event_bus import EventBus
    from brakit.store.fetch_store import FetchStore


def emit_fetch_entry(
    fetch_store: FetchStore,
    bus: EventBus,
    url: str,
    method: str,
    status_code: int,
    duration_ms: float,
    request_id: str | None,
    fetch_id: str | None = None,
) -> None:
    """Emit a traced fetch event."""
    entry = TracedFetch(
        id=uuid.uuid4().hex,
        parent_request_id=request_id,
        timestamp=time.time() * 1_000,
        url=sanitize_url(url),
        method=method.upper(),
        status_code=status_code,
        duration_ms=round(duration_ms, 2),
        fetch_id=fetch_id,
    )
    fetch_store.add(entry)
    bus.emit(CHANNEL_TELEMETRY_FETCH, entry)
