"""Type alias — ErrorStore is just TelemetryStore[TracedError]."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedError

ErrorStore = TelemetryStore[TracedError]
