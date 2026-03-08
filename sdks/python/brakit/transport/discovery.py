"""Discover the brakit CLI port by walking parent directories or reading env vars."""
from __future__ import annotations

import os
from pathlib import Path

from brakit.constants.network import (
    BRAKIT_DIR_NAME,
    ENV_PORT_KEY,
    MAX_PARENT_DEPTH,
    PORT_FILE_NAME,
)


def discover_port() -> int | None:
    env_val = os.environ.get(ENV_PORT_KEY)
    if env_val:
        try:
            return int(env_val)
        except ValueError:
            return None

    current = Path.cwd().resolve()

    for _ in range(MAX_PARENT_DEPTH):
        port = _read_port_file(current / BRAKIT_DIR_NAME / PORT_FILE_NAME)
        if port is not None:
            return port

        parent = current.parent
        if parent == current:
            break

        # Check sibling directories at this level
        try:
            for sibling in parent.iterdir():
                if sibling == current or not sibling.is_dir():
                    continue
                port = _read_port_file(
                    sibling / BRAKIT_DIR_NAME / PORT_FILE_NAME,
                )
                if port is not None:
                    return port
        except OSError:
            pass

        current = parent

    return None


def _read_port_file(path: Path) -> int | None:
    try:
        content = path.read_text().strip()
        if content:
            return int(content)
    except (OSError, ValueError):
        pass
    return None
