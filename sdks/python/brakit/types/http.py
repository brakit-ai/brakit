"""Data types for traced HTTP requests and responses."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


@dataclass(frozen=True)
class TracedRequest:
    id: str
    method: str
    url: str
    status_code: int
    duration_ms: float
    timestamp: float
    headers: dict[str, str] = field(default_factory=dict)
    response_headers: dict[str, str] = field(default_factory=dict)
    request_body: str | None = None
    response_body: str | None = None
    response_size: int = 0
    is_static: bool = False
    is_health_check: bool = False
