"""Tests for CircuitBreaker state transitions."""
from __future__ import annotations

import time

from brakit.core.circuit_breaker import CircuitBreaker


def test_initial_state_closed() -> None:
    cb = CircuitBreaker(threshold=3)
    assert not cb.is_open


def test_trips_after_threshold() -> None:
    cb = CircuitBreaker(threshold=3)
    for _ in range(3):
        cb.record_failure()
    assert cb.is_open


def test_does_not_trip_below_threshold() -> None:
    cb = CircuitBreaker(threshold=3)
    cb.record_failure()
    cb.record_failure()
    assert not cb.is_open


def test_success_resets() -> None:
    cb = CircuitBreaker(threshold=2)
    cb.record_failure()
    cb.record_success()
    cb.record_failure()
    assert not cb.is_open


def test_half_open_after_cooldown() -> None:
    cb = CircuitBreaker(threshold=1, cooldown_s=0.05)
    cb.record_failure()
    assert cb.is_open
    time.sleep(0.06)
    assert not cb.is_open  # half-open: allows probe
