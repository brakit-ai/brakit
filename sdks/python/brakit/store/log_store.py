"""Type alias — LogStore is just TelemetryStore[TracedLog]."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedLog

LogStore = TelemetryStore[TracedLog]
