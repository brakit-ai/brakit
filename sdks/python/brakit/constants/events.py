"""Event bus channel names and SDK event type identifiers."""
from __future__ import annotations

CHANNEL_REQUEST_COMPLETED: str = "request:completed"
CHANNEL_TELEMETRY_FETCH: str = "telemetry:fetch"
CHANNEL_TELEMETRY_LOG: str = "telemetry:log"
CHANNEL_TELEMETRY_ERROR: str = "telemetry:error"
CHANNEL_TELEMETRY_QUERY: str = "telemetry:query"

EVENT_TYPE_REQUEST: str = "request"
EVENT_TYPE_FETCH: str = "fetch"
EVENT_TYPE_LOG: str = "log"
EVENT_TYPE_ERROR: str = "error"
EVENT_TYPE_QUERY: str = "db.query"
