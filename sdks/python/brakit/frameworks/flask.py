"""Flask framework adapter. Patches Flask.__init__ to inject request capture hooks."""
from __future__ import annotations

import logging
import time
from typing import Any, TYPE_CHECKING

from brakit.constants.events import CHANNEL_REQUEST_COMPLETED, CHANNEL_TELEMETRY_ERROR
from brakit.constants.limits import MAX_BODY_CAPTURE
from brakit.constants.logger import LOGGER_NAME
from brakit.core.context import clear_request_id, set_request_id
from brakit.core.decompress import decompress_body
from brakit.frameworks._shared import (
    is_static,
    propagate_request_id,
    build_traced_request,
    build_traced_error,
)

if TYPE_CHECKING:
    from brakit.core.registry import ServiceRegistry

logger = logging.getLogger(LOGGER_NAME)

_FLASK_G_REQUEST_ID = "_brakit_request_id"
_FLASK_G_START = "_brakit_start"
_FLASK_G_IS_CHILD = "_brakit_is_child"


class FlaskAdapter:
    name = "flask"
    _patched = False
    _original_init: Any = None

    def detect(self) -> bool:
        try:
            import flask  # noqa: F401
            return True
        except ImportError:
            return False

    def patch(self, registry: ServiceRegistry) -> None:
        if FlaskAdapter._patched:
            return
        try:
            import flask
        except ImportError:
            return

        original_init = flask.Flask.__init__

        def _patched_init(self_app: Any, *args: Any, **kwargs: Any) -> None:
            original_init(self_app, *args, **kwargs)
            _install_hooks(self_app, registry)

        FlaskAdapter._original_init = original_init
        flask.Flask.__init__ = _patched_init  # type: ignore[assignment]
        FlaskAdapter._patched = True

    def unpatch(self) -> None:
        if not FlaskAdapter._patched:
            return
        try:
            import flask
            if FlaskAdapter._original_init is not None:
                flask.Flask.__init__ = FlaskAdapter._original_init  # type: ignore[assignment]
                FlaskAdapter._original_init = None
        except Exception:
            logger.debug("flask unpatch failed", exc_info=True)
        FlaskAdapter._patched = False


def _install_hooks(app: Any, registry: ServiceRegistry) -> None:
    import flask

    _banner_printed = False

    @app.before_request
    def _before() -> None:
        nonlocal _banner_printed
        if not _banner_printed:
            _banner_printed = True
            port_str = flask.request.host.split(":")[-1] if ":" in flask.request.host else None
            if port_str and port_str.isdigit():
                from brakit.transport.port_file import write_port_if_needed
                write_port_if_needed(int(port_str))

        req_headers = dict(flask.request.headers)
        # Flask headers are case-insensitive; lower-case them for propagate_request_id
        lower_headers = {k.lower(): v for k, v in req_headers.items()}
        rid, _fetch_id, is_child = propagate_request_id(lower_headers)
        set_request_id(rid)
        setattr(flask.g, _FLASK_G_REQUEST_ID, rid)
        setattr(flask.g, _FLASK_G_IS_CHILD, is_child)
        setattr(flask.g, _FLASK_G_START, time.perf_counter())

    @app.after_request
    def _after(response: Any) -> Any:
        start: float | None = getattr(flask.g, _FLASK_G_START, None)
        rid: str | None = getattr(flask.g, _FLASK_G_REQUEST_ID, None)
        if start is None or rid is None:
            return response

        duration_ms = (time.perf_counter() - start) * 1_000
        path = flask.request.path

        request_body: str | None = None
        try:
            raw = flask.request.get_data(as_text=True)
            if raw:
                request_body = raw[:MAX_BODY_CAPTURE]
        except Exception:
            logger.debug("failed to read request body", exc_info=True)

        response_body: str | None = None
        response_size = 0
        try:
            if response.is_streamed:
                response_body = None
            else:
                raw_bytes = response.get_data(as_text=False)
                response_size = len(raw_bytes)
                if raw_bytes and not is_static(path):
                    raw_bytes = decompress_body(
                        raw_bytes, response.headers.get("Content-Encoding")
                    )
                    response_body = raw_bytes.decode("utf-8", errors="replace")[
                        :MAX_BODY_CAPTURE
                    ]
        except Exception:
            logger.debug("failed to read response body", exc_info=True)

        is_child: bool = getattr(flask.g, _FLASK_G_IS_CHILD, False)

        if not is_child:
            entry = build_traced_request(
                rid=rid,
                method=flask.request.method,
                url=path,
                path=path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                headers=dict(flask.request.headers),
                response_headers=dict(response.headers),
                request_body=request_body,
                response_body=response_body,
                response_size=response_size,
            )

            registry.request_store.add(entry)
            registry.bus.emit(CHANNEL_REQUEST_COMPLETED, entry)

        clear_request_id()
        return response

    @app.teardown_request
    def _on_error(exc: BaseException | None) -> None:
        if exc is None:
            return
        rid: str | None = getattr(flask.g, _FLASK_G_REQUEST_ID, None)
        error_entry = build_traced_error(exc, rid)
        registry.error_store.add(error_entry)
        registry.bus.emit(CHANNEL_TELEMETRY_ERROR, error_entry)
