"""Ring-buffer store for traced database queries."""
from brakit.store.base import TelemetryStore
from brakit.types.telemetry import TracedQuery


class QueryStore(TelemetryStore[TracedQuery]):
    pass
