"""Type alias — QueryStore is just TelemetryStore[TracedQuery]."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedQuery

QueryStore = TelemetryStore[TracedQuery]
