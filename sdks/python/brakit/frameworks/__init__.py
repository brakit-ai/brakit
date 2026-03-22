"""Detect and patch supported web frameworks (Flask, FastAPI)."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from brakit.constants.logger import LOGGER_NAME

if TYPE_CHECKING:
    from brakit.core.registry import ServiceRegistry

logger = logging.getLogger(LOGGER_NAME)


def detect_and_patch(registry: ServiceRegistry) -> str:
    from brakit.frameworks.flask import FlaskAdapter
    from brakit.frameworks.fastapi import FastAPIAdapter

    detected = "unknown"
    for adapter in (FlaskAdapter(), FastAPIAdapter()):
        if adapter.detect():
            try:
                adapter.patch(registry)
                detected = adapter.name
            except Exception:
                logger.debug("failed to patch %s", adapter.name, exc_info=True)
    return detected
