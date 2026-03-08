"""Protocol definition for framework adapters."""
from __future__ import annotations

from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from brakit.core.registry import ServiceRegistry


@runtime_checkable
class FrameworkAdapter(Protocol):
    name: str

    def detect(self) -> bool: ...

    def patch(self, registry: ServiceRegistry) -> None: ...

    def unpatch(self) -> None: ...
