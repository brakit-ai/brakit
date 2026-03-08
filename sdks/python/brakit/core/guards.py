"""Environment guards that decide whether brakit should activate."""
from __future__ import annotations

import os

from brakit.constants.network import (
    CI_SIGNALS,
    CLOUD_SIGNALS,
    ENV_DISABLE_KEY,
    PRODUCTION_SIGNALS,
    PRODUCTION_VALUES,
)


def should_activate() -> bool:
    if os.environ.get(ENV_DISABLE_KEY, "").lower() in ("true", "1"):
        return False

    for signal in PRODUCTION_SIGNALS:
        val = os.environ.get(signal, "").lower()
        if val in PRODUCTION_VALUES:
            return False

    for signal in CI_SIGNALS:
        if os.environ.get(signal):
            return False

    for signal in CLOUD_SIGNALS:
        if os.environ.get(signal):
            return False

    return True
