"""Data types for traced telemetry events (queries, fetches, logs, errors)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Union

NormalizedOp = Literal["SELECT", "INSERT", "UPDATE", "DELETE", "OTHER"]

# Python logging levels. Mapped to TS levels by sdk-event-parser.ts LOG_LEVEL_MAP
# (warning -> warn, critical -> error).
LogLevel = Literal["debug", "info", "warning", "error", "critical"]

# Node.js SDK additionally supports: pg, mysql2, prisma
DriverName = Literal["asyncpg", "sqlalchemy", "sdk"]


@dataclass(frozen=True)
class TracedQuery:
    id: str
    parent_request_id: str | None
    timestamp: float
    driver: DriverName
    sql: str | None
    operation: NormalizedOp
    table: str
    duration_ms: float
    row_count: int | None = None
    parent_fetch_id: str | None = None


@dataclass(frozen=True)
class TracedFetch:
    id: str
    parent_request_id: str | None
    timestamp: float
    url: str
    method: str
    status_code: int
    duration_ms: float
    fetch_id: str | None = None


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


# Union required at runtime (Python 3.9 compat); X | Y only works in annotations.
TelemetryEntry = Union[TracedQuery, TracedFetch, TracedLog, TracedError]
