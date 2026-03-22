"""Lightweight anonymous telemetry for the Python SDK.

Sends a single 'session' event to PostHog on process exit. No PII is collected —
only framework names, adapter names, counts, and durations.

Disabled via BRAKIT_TELEMETRY=false environment variable.
"""
from __future__ import annotations

import atexit
import json
import os
import platform
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

_POSTHOG_HOST = "https://us.i.posthog.com"
_POSTHOG_PATH = "/i/v0/e/"
_POSTHOG_KEY = os.environ.get("POSTHOG_API_KEY", "")
_TIMEOUT_MS = 3000
_CONFIG_DIR = Path.home() / ".brakit"
_CONFIG_FILE = _CONFIG_DIR / "config.json"

_session: dict[str, Any] = {
    "start_time": 0.0,
    "framework": "unknown",
    "adapters": [],
    "request_count": 0,
    "query_count": 0,
    "error_count": 0,
    "node_connected": False,
}


def _is_enabled() -> bool:
    val = os.environ.get("BRAKIT_TELEMETRY", "").lower()
    return val not in ("false", "0", "off")


def _get_anonymous_id() -> str:
    """Read or create a persistent anonymous ID (shared with Node SDK)."""
    try:
        if _CONFIG_FILE.exists():
            config = json.loads(_CONFIG_FILE.read_text())
            if "anonymousId" in config:
                return config["anonymousId"]
        _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        anonymous_id = str(uuid.uuid4())
        _CONFIG_FILE.write_text(json.dumps({
            "telemetry": True,
            "anonymousId": anonymous_id,
        }))
        return anonymous_id
    except Exception:
        return str(uuid.uuid4())


def _get_version() -> str:
    """Read version from package metadata."""
    try:
        from importlib.metadata import version
        return version("brakit")
    except Exception:
        return "unknown"


def init_session(framework: str, adapters: list[str]) -> None:
    _session["start_time"] = time.time()
    _session["framework"] = framework
    _session["adapters"] = adapters


def record_node_connected() -> None:
    _session["node_connected"] = True


def record_counts(*, requests: int = 0, queries: int = 0, errors: int = 0) -> None:
    _session["request_count"] = requests
    _session["query_count"] = queries
    _session["error_count"] = errors


def _send_session() -> None:
    if not _is_enabled() or not _POSTHOG_KEY:
        return

    duration_s = int(time.time() - _session["start_time"]) if _session["start_time"] else 0

    payload = json.dumps({
        "api_key": _POSTHOG_KEY,
        "event": "session",
        "distinct_id": _get_anonymous_id(),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "properties": {
            "sdk": "python",
            "brakit_version": _get_version(),
            "python_version": platform.python_version(),
            "os": f"{sys.platform}-{platform.release()}",
            "arch": platform.machine(),
            "framework": _session["framework"],
            "adapters_detected": _session["adapters"],
            "request_count": _session["request_count"],
            "query_count": _session["query_count"],
            "error_count": _session["error_count"],
            "brakit_node_connected": _session["node_connected"],
            "session_duration_s": duration_s,
            "$lib": "brakit",
            "$process_person_profile": False,
            "$geoip_disable": True,
        },
    })

    # Fire-and-forget via subprocess — never blocks the host app
    url = f"{_POSTHOG_HOST}{_POSTHOG_PATH}"
    try:
        subprocess.Popen(
            [
                sys.executable, "-c",
                f"import urllib.request; urllib.request.urlopen("
                f"urllib.request.Request({url!r}, data={payload.encode()!r}, "
                f"headers={{'Content-Type': 'application/json'}}), timeout={_TIMEOUT_MS / 1000})",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception:
        pass


# Register atexit handler to send session telemetry on shutdown
atexit.register(_send_session)
