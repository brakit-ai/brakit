"""Ring-buffer store for traced outgoing HTTP fetches."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedFetch


class FetchStore(TelemetryStore[TracedFetch]):
    pass
