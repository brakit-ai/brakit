"""Ring-buffer store for traced log entries."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedLog


class LogStore(TelemetryStore[TracedLog]):
    pass
