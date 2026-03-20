"""Type alias — FetchStore is just TelemetryStore[TracedFetch]."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedFetch

FetchStore = TelemetryStore[TracedFetch]
