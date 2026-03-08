"""Data types for traced telemetry events (queries, fetches, logs, errors)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

NormalizedOp = Literal["SELECT", "INSERT", "UPDATE", "DELETE", "OTHER"]
LogLevel = Literal["debug", "info", "warning", "error", "critical"]


@dataclass(frozen=True)
class TracedQuery:
    id: str
    parent_request_id: str | None
    timestamp: float
    driver: str
    sql: str | None
    operation: NormalizedOp
    table: str
    duration_ms: float
    row_count: int | None = None


@dataclass(frozen=True)
class TracedFetch:
    id: str
    parent_request_id: str | None
    timestamp: float
    url: str
    method: str
    status_code: int
    duration_ms: float


@dataclass(frozen=True)
class TracedLog:
    id: str
    parent_request_id: str | None
    timestamp: float
    level: LogLevel
    message: str


@dataclass(frozen=True)
class TracedError:
    id: str
    parent_request_id: str | None
    timestamp: float
    name: str
    message: str
    stack: str
