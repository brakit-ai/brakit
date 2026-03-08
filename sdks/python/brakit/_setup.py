"""Brakit SDK initialization. Wires stores, hooks, adapters, transport, and frameworks."""
from __future__ import annotations

import dataclasses
import logging
import time

from brakit.constants.events import (
    CHANNEL_REQUEST_COMPLETED,
    CHANNEL_TELEMETRY_ERROR,
    CHANNEL_TELEMETRY_FETCH,
    CHANNEL_TELEMETRY_LOG,
    CHANNEL_TELEMETRY_QUERY,
)
from brakit.constants.logger import LOGGER_NAME
from brakit.core.guards import should_activate
from brakit.types.events import EventType, SDKEvent
from brakit.types.http import TracedRequest

logger = logging.getLogger(LOGGER_NAME)

_initialized = False


def _auto_setup() -> None:
    global _initialized
    if _initialized:
        return
    _initialized = True

    if not should_activate():
        logger.debug("skipped (production/CI/cloud/disabled)")
        return

    registry = _create_registry()
    _install_hooks(registry)
    _install_adapters(registry)
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

    patch_all(registry.log_store, registry.fetch_store, registry.bus)


def _install_adapters(registry: "ServiceRegistry") -> None:
    from brakit.adapters import detect_and_patch as detect_db_adapters

    detect_db_adapters(registry.query_store, registry.bus)


def _start_transport(registry: "ServiceRegistry") -> None:
    from brakit.transport.discovery import discover_port
    from brakit.transport.forwarder import Forwarder
    from brakit.transport.port_file import enable_port_writing

    port = discover_port()
    if port is not None:
        forwarder = Forwarder(port=port)
        forwarder.start()

        registry.bus.on(CHANNEL_REQUEST_COMPLETED, lambda r: _forward_request(forwarder, r))
        registry.bus.on(CHANNEL_TELEMETRY_FETCH, lambda e: _forward_telemetry(forwarder, "fetch", e))
        registry.bus.on(CHANNEL_TELEMETRY_LOG, lambda e: _forward_telemetry(forwarder, "log", e))
        registry.bus.on(CHANNEL_TELEMETRY_ERROR, lambda e: _forward_telemetry(forwarder, "error", e))
        registry.bus.on(CHANNEL_TELEMETRY_QUERY, lambda e: _forward_telemetry(forwarder, "db.query", e))

    enable_port_writing()


def _install_frameworks(registry: "ServiceRegistry") -> None:
    from brakit.frameworks import detect_and_patch as detect_frameworks

    detect_frameworks(registry)


def _forward_request(forwarder: "Forwarder", request: TracedRequest) -> None:
    data = dataclasses.asdict(request)
    event = SDKEvent(
        type="request",
        request_id=data.get("id"),
        timestamp=time.time() * 1_000,
        data=data,
    )
    forwarder.send(event)


def _forward_telemetry(forwarder: "Forwarder", event_type: EventType, entry: object) -> None:
    data = dataclasses.asdict(entry)  # type: ignore[call-overload]
    event = SDKEvent(
        type=event_type,
        request_id=data.get("parent_request_id"),
        timestamp=time.time() * 1_000,
        data=data,
    )
    forwarder.send(event)
