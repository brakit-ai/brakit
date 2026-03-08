"""Circuit breaker with half-open recovery for telemetry forwarding."""
from __future__ import annotations

import threading
import time

from brakit.constants import MAX_HEALTH_ERRORS

_DEFAULT_COOLDOWN_S: float = 30.0


class CircuitBreaker:
    """Trips after `threshold` consecutive failures, recovers after `cooldown_s`."""

    def __init__(
        self,
        threshold: int = MAX_HEALTH_ERRORS,
        cooldown_s: float = _DEFAULT_COOLDOWN_S,
    ) -> None:
        self._threshold = threshold
        self._cooldown_s = cooldown_s
        self._consecutive_failures = 0
        self._tripped = False
        self._tripped_at: float = 0.0
        self._lock = threading.Lock()

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._tripped = False

    def record_failure(self) -> None:
        with self._lock:
            self._consecutive_failures += 1
            if self._consecutive_failures >= self._threshold:
                self._tripped = True
                self._tripped_at = time.monotonic()

    @property
    def is_open(self) -> bool:
        with self._lock:
            if not self._tripped:
                return False
            # Half-open: allow a probe after cooldown
            if time.monotonic() - self._tripped_at >= self._cooldown_s:
                return False
            return True
