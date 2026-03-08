"""Utilities shared across all framework adapters."""
from __future__ import annotations

from brakit.constants.patterns import STATIC_EXTENSIONS


def is_static(path: str) -> bool:
    """Return True if the path looks like a static asset."""
    for ext in STATIC_EXTENSIONS:
        if path.endswith(ext):
            return True
    return False
