"""Ring-buffer store for traced application errors."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedError


class ErrorStore(TelemetryStore[TracedError]):
    pass
