"""FastAPI framework adapter. Patches FastAPI.__init__ to inject request capture middleware."""
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


class FastAPIAdapter:
    name = "fastapi"
    _patched = False
    _original_init: Any = None

    def detect(self) -> bool:
        try:
            import fastapi  # noqa: F401
            return True
        except ImportError:
            return False

    def patch(self, registry: ServiceRegistry) -> None:
        if FastAPIAdapter._patched:
            return
        try:
            import fastapi
        except ImportError:
            return

        original_init = fastapi.FastAPI.__init__

        def _patched_init(self_app: Any, *args: Any, **kwargs: Any) -> None:
            original_init(self_app, *args, **kwargs)
            _install_middleware(self_app, registry)

        FastAPIAdapter._original_init = original_init
        fastapi.FastAPI.__init__ = _patched_init  # type: ignore[assignment]
        FastAPIAdapter._patched = True

    def unpatch(self) -> None:
        if not FastAPIAdapter._patched:
            return
        try:
            import fastapi
            if FastAPIAdapter._original_init is not None:
                fastapi.FastAPI.__init__ = FastAPIAdapter._original_init  # type: ignore[assignment]
                FastAPIAdapter._original_init = None
        except Exception:
            logger.debug("fastapi unpatch failed", exc_info=True)
        FastAPIAdapter._patched = False


def _install_middleware(app: Any, registry: ServiceRegistry) -> None:
    """Install a raw ASGI middleware that captures request/response telemetry.

    Uses raw scope/receive/send wrapping instead of Starlette's BaseHTTPMiddleware
    to avoid: body buffering, StreamingResponse breakage, and task context issues.
    """
    _banner_printed = False

    class BrakitASGIMiddleware:
        def __init__(self, inner_app: Any) -> None:
            self.app = inner_app

        async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
            if scope["type"] != "http":
                await self.app(scope, receive, send)
                return

            nonlocal _banner_printed
            if not _banner_printed:
                _banner_printed = True
                for key, val in scope.get("headers", []):
                    if key == b"host":
                        host_str = val.decode("latin-1")
                        port_str = host_str.split(":")[-1] if ":" in host_str else None
                        if port_str and port_str.isdigit():
                            from brakit.transport.port_file import write_port_if_needed
                            write_port_if_needed(int(port_str))
                        break

            path: str = scope.get("path", scope.get("root_path", "") + scope.get("path", "/"))
            req_headers = {
                k.decode("latin-1"): v.decode("latin-1")
                for k, v in scope.get("headers", [])
            }

            rid, fetch_id, is_child = propagate_request_id(req_headers)
            set_request_id(rid, fetch_id=fetch_id)
            start = time.perf_counter()

            # Capture request body by wrapping receive
            request_body_chunks: list[bytes] = []
            request_body_size = 0

            async def receive_wrapper() -> dict[str, Any]:
                nonlocal request_body_size
                message: dict[str, Any] = await receive()
                if message.get("type") == "http.request":
                    body = message.get("body", b"")
                    if body and request_body_size < MAX_BODY_CAPTURE:
                        request_body_chunks.append(body)
                        request_body_size += len(body)
                return message

            # Capture response by wrapping send
            status_code = 0
            resp_headers: dict[str, str] = {}
            response_body_chunks: list[bytes] = []
            response_body_size = 0

            async def send_wrapper(message: dict[str, Any]) -> None:
                nonlocal status_code, resp_headers, response_body_size
                if message.get("type") == "http.response.start":
                    status_code = message.get("status", 0)
                    raw_headers = message.get("headers", [])
                    resp_headers = {
                        k.decode("latin-1"): v.decode("latin-1")
                        for k, v in raw_headers
                    }
                elif message.get("type") == "http.response.body":
                    body = message.get("body", b"")
                    if body and response_body_size < MAX_BODY_CAPTURE:
                        response_body_chunks.append(body)
                        response_body_size += len(body)
                await send(message)

            try:
                await self.app(scope, receive_wrapper, send_wrapper)
            except Exception as exc:
                status_code = 500
                error_entry = build_traced_error(exc, rid)
                registry.error_store.add(error_entry)
                registry.bus.emit(CHANNEL_TELEMETRY_ERROR, error_entry)
                raise
            finally:
                duration_ms = (time.perf_counter() - start) * 1_000

                if not is_child:
                    request_body: str | None = None
                    try:
                        raw_req = b"".join(request_body_chunks)
                        if raw_req:
                            request_body = raw_req.decode("utf-8", errors="replace")[
                                :MAX_BODY_CAPTURE
                            ]
                    except Exception:
                        logger.debug("failed to decode request body", exc_info=True)

                    response_body: str | None = None
                    response_size = response_body_size
                    try:
                        if not is_static(path):
                            raw_resp = b"".join(response_body_chunks)
                            if raw_resp:
                                raw_resp = decompress_body(
                                    raw_resp, resp_headers.get("content-encoding")
                                )
                                response_body = raw_resp.decode("utf-8", errors="replace")[
                                    :MAX_BODY_CAPTURE
                                ]
                    except Exception:
                        logger.debug("failed to decode response body", exc_info=True)

                    method = scope.get("method", "GET")
                    entry = build_traced_request(
                        rid=rid,
                        method=method,
                        url=path,
                        path=path,
                        status_code=status_code,
                        duration_ms=duration_ms,
                        headers=req_headers,
                        response_headers=resp_headers,
                        request_body=request_body,
                        response_body=response_body,
                        response_size=response_size,
                    )

                    registry.request_store.add(entry)
                    registry.bus.emit(CHANNEL_REQUEST_COMPLETED, entry)

                clear_request_id()

    app.add_middleware(BrakitASGIMiddleware)
