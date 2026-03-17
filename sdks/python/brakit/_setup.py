"""Brakit SDK initialization. Wires stores, hooks, adapters, transport, and frameworks."""
from __future__ import annotations

import dataclasses
import logging
import threading
import time

from brakit.constants.events import (
    CHANNEL_REQUEST_COMPLETED,
    CHANNEL_TELEMETRY_ERROR,
    CHANNEL_TELEMETRY_FETCH,
    CHANNEL_TELEMETRY_LOG,
    CHANNEL_TELEMETRY_QUERY,
    EVENT_TYPE_ERROR,
    EVENT_TYPE_FETCH,
    EVENT_TYPE_LOG,
    EVENT_TYPE_QUERY,
    EVENT_TYPE_REQUEST,
)
from brakit.constants.logger import LOGGER_NAME
from brakit.constants.transport import PORT_RETRY_COUNT, PORT_RETRY_INTERVAL_S
from brakit.core.guards import should_activate
from brakit.types.events import EventType, SDKEvent
from brakit.types.http import TracedRequest
from brakit.types.telemetry import TelemetryEntry

logger = logging.getLogger(LOGGER_NAME)

_init_lock = threading.Lock()
_initialized = False


def _auto_setup() -> None:
    global _initialized
    with _init_lock:
        if _initialized:
            return
        _initialized = True

    if not should_activate():
        logger.debug("skipped (production/CI/cloud/disabled)")
        return

    registry = _create_registry()
    _install_hooks(registry)
    adapters = _install_adapters(registry)
    logger.debug("adapters: %s", adapters)
    _start_transport(registry)
    _install_frameworks(registry)

    logger.debug("initialized")


def _create_registry() -> "ServiceRegistry":
    from brakit.core.event_bus import EventBus
    from brakit.core.registry import ServiceRegistry
    from brakit.store.error_store import ErrorStore
    from brakit.store.fetch_store import FetchStore
    from brakit.store.log_store import LogStore
    from brakit.store.query_store import QueryStore
    from brakit.store.request_store import RequestStore

    return ServiceRegistry(
        bus=EventBus(),
        request_store=RequestStore(),
        query_store=QueryStore(),
        fetch_store=FetchStore(),
        log_store=LogStore(),
        error_store=ErrorStore(),
    )


def _install_hooks(registry: "ServiceRegistry") -> None:
    from brakit.hooks import patch_all

    patch_all(registry.log_store, registry.fetch_store, registry.error_store, registry.bus)


def _install_adapters(registry: "ServiceRegistry") -> list[str]:
    from brakit.adapters import detect_and_patch as detect_db_adapters

    return detect_db_adapters(registry.query_store, registry.bus)


def _start_transport(registry: "ServiceRegistry") -> None:
    from brakit.transport.discovery import discover_port
    from brakit.transport.port_file import cleanup_stale_port_file, enable_port_writing

    cleanup_stale_port_file()
    port = discover_port()

    if port is not None:
        _setup_forwarder(registry, port)
        return

    # Port file not found — the Node.js server may not have received its first
    # request yet (the port file is written on first request, not on startup).
    # Retry discovery in a background thread so we don't block import.
    def _retry() -> None:
        for _ in range(PORT_RETRY_COUNT):
            time.sleep(PORT_RETRY_INTERVAL_S)
            found = discover_port()
            if found is not None:
                _setup_forwarder(registry, found)
                return
        logger.debug("no port found after retries, standalone mode")
        enable_port_writing()

    threading.Thread(
        target=_retry, daemon=True, name="brakit-port-discovery",
    ).start()


def _setup_forwarder(registry: "ServiceRegistry", port: int) -> None:
    from brakit.transport.forwarder import Forwarder

    forwarder = Forwarder(port=port)
    forwarder.start()

    registry.bus.on(CHANNEL_REQUEST_COMPLETED, lambda r: _forward_request(forwarder, r))
    registry.bus.on(CHANNEL_TELEMETRY_FETCH, lambda e: _forward_telemetry(forwarder, EVENT_TYPE_FETCH, e))
    registry.bus.on(CHANNEL_TELEMETRY_LOG, lambda e: _forward_telemetry(forwarder, EVENT_TYPE_LOG, e))
    registry.bus.on(CHANNEL_TELEMETRY_ERROR, lambda e: _forward_telemetry(forwarder, EVENT_TYPE_ERROR, e))
    registry.bus.on(CHANNEL_TELEMETRY_QUERY, lambda e: _forward_telemetry(forwarder, EVENT_TYPE_QUERY, e))

    logger.debug("transport ready on port %d", port)


def _install_frameworks(registry: "ServiceRegistry") -> None:
    from brakit.frameworks import detect_and_patch as detect_frameworks

    detect_frameworks(registry)


def _forward_request(forwarder: "Forwarder", request: TracedRequest) -> None:
    raw = dataclasses.asdict(request)
    data = {_to_camel(k): v for k, v in raw.items()}
    event = SDKEvent(
        type=EVENT_TYPE_REQUEST,
        request_id=raw.get("id"),
        timestamp=time.time() * 1_000,
        data=data,
    )
    forwarder.send(event)


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def _forward_telemetry(forwarder: "Forwarder", event_type: EventType, entry: TelemetryEntry) -> None:
    raw = dataclasses.asdict(entry)
    data = {_to_camel(k): v for k, v in raw.items()}
    event = SDKEvent(
        type=event_type,
        request_id=raw.get("parent_request_id"),
        timestamp=time.time() * 1_000,
        data=data,
    )
    forwarder.send(event)
