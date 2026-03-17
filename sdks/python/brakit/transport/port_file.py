"""Write and clean up the .brakit/port file for CLI discovery."""
from __future__ import annotations

import atexit
import logging
import threading
from pathlib import Path

from brakit.constants.logger import LOGGER_NAME
from brakit.constants.network import BRAKIT_DIR_NAME, PORT_FILE_NAME

logger = logging.getLogger(LOGGER_NAME)

_lock = threading.Lock()
_should_write = False
_written = False
_port_path: Path | None = None


def cleanup_stale_port_file() -> None:
    """Remove any leftover .brakit/port in CWD from a previous run.

    Called at startup *before* port discovery so we don't accidentally
    discover our own stale port file from a previous session.
    """
    try:
        stale = Path.cwd().resolve() / BRAKIT_DIR_NAME / PORT_FILE_NAME
        if stale.exists():
            stale.unlink()
            logger.debug("removed stale port file %s", stale)
    except Exception:
        pass


def enable_port_writing() -> None:
    """Enable port file writing. Called when no Node.js server is found (standalone mode)."""
    global _should_write
    with _lock:
        _should_write = True


def write_port_if_needed(port: int) -> None:
    """Write .brakit/port on first request so the MCP server can discover this app."""
    global _written, _port_path

    with _lock:
        if not _should_write or _written:
            return

        try:
            brakit_dir = Path.cwd().resolve() / BRAKIT_DIR_NAME
            brakit_dir.mkdir(parents=True, exist_ok=True)
            port_path = brakit_dir / PORT_FILE_NAME
            port_path.write_text(str(port))
            _port_path = port_path
            _written = True
            atexit.register(_cleanup)
            logger.debug("wrote port file %s", port_path)
        except Exception:
            logger.debug("failed to write port file", exc_info=True)


def _cleanup() -> None:
    """Remove port file on exit."""
    try:
        with _lock:
            path = _port_path
        if path is not None and path.exists():
            path.unlink()
    except Exception:
        pass
