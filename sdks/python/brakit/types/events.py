"""SDK event types used for internal event-bus communication."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

EventType = Literal["request", "db.query", "fetch", "log", "error"]


@dataclass
class SDKEvent:
    type: EventType
    timestamp: float
    data: dict[str, object]
    request_id: str | None = None


@dataclass
class EventBatch:
    events: list[SDKEvent] = field(default_factory=list)
    _brakit: bool = True
    version: int = 1
    sdk: str = ""
