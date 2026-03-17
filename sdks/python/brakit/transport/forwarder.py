"""Background thread that batches and forwards telemetry events to the Node.js core."""
from __future__ import annotations

import json
import logging
import threading
import time
import urllib.request
from collections import deque

from brakit.constants.logger import LOGGER_NAME
from brakit.constants.routes import ROUTE_INGEST
from brakit.constants.transport import BATCH_SIZE, FLUSH_INTERVAL_S, MAX_QUEUE_SIZE, TRANSPORT_TIMEOUT_S
from brakit.core.circuit_breaker import CircuitBreaker
from brakit.types.events import SDKEvent

logger = logging.getLogger(LOGGER_NAME)

SDK_INGEST_VERSION: int = 1


def _sdk_identifier() -> str:
    try:
        from importlib.metadata import version
        return f"brakit-python/{version('brakit')}"
    except Exception:
        return "brakit-python/0.0.0"


SDK_IDENTIFIER: str = _sdk_identifier()


class Forwarder:
    def __init__(self, port: int) -> None:
        self._url = f"http://localhost:{port}{ROUTE_INGEST}"
        self._queue: deque[dict[str, object]] = deque(maxlen=MAX_QUEUE_SIZE)
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None
        self._breaker = CircuitBreaker()

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name="brakit-forwarder",
        )
        self._thread.start()

    def stop(self, timeout: float = 2.0) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=timeout)
        self._flush()

    def __enter__(self) -> Forwarder:
        self.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.stop()

    def send(self, event: SDKEvent) -> None:
        if self._breaker.is_open:
            return

        serialized: dict[str, object] = {
            "type": event.type,
            "timestamp": event.timestamp,
            "data": event.data,
        }
        if event.request_id is not None:
            serialized["requestId"] = event.request_id

        with self._lock:
            self._queue.append(serialized)
            if len(self._queue) >= BATCH_SIZE:
                self._flush_locked()

    def _run(self) -> None:
        while self._running:
            time.sleep(FLUSH_INTERVAL_S)
            self._flush()

    def _flush(self) -> None:
        with self._lock:
            self._flush_locked()

    def _flush_locked(self) -> None:
        if not self._queue:
            return

        events = list(self._queue)
        self._queue.clear()

        payload = json.dumps({
            "_brakit": True,
            "version": SDK_INGEST_VERSION,
            "sdk": SDK_IDENTIFIER,
            "events": events,
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                self._url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            resp = urllib.request.urlopen(req, timeout=TRANSPORT_TIMEOUT_S)
            logger.debug("flushed %d events to %s → %d", len(events), self._url, resp.status)
            self._breaker.record_success()
        except Exception:
            logger.debug("forward flush failed to %s", self._url, exc_info=True)
            self._breaker.record_failure()
