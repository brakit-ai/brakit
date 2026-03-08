"""FastAPI framework adapter. Patches FastAPI.__init__ to inject request capture middleware."""
from __future__ import annotations

import logging
import time
import traceback
import uuid
from typing import Any, TYPE_CHECKING

from brakit.constants.events import CHANNEL_REQUEST_COMPLETED, CHANNEL_TELEMETRY_ERROR
from brakit.constants.limits import MAX_BODY_CAPTURE
from brakit.constants.logger import LOGGER_NAME
from brakit.core.context import clear_request_id, set_request_id
from brakit.core.sanitize import sanitize_headers
from brakit.frameworks._shared import is_static
from brakit.types.http import TracedRequest
from brakit.types.telemetry import TracedError

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
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request
    from starlette.responses import Response

    _banner_printed = False

    class BrakitMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next: Any) -> Response:
            nonlocal _banner_printed
            if not _banner_printed:
                _banner_printed = True
                host = request.headers.get("host", "localhost")
                port_str = host.split(":")[-1] if ":" in host else None
                if port_str and port_str.isdigit():
                    from brakit.transport.port_file import write_port_if_needed
                    write_port_if_needed(int(port_str))

            path = request.url.path
            rid = uuid.uuid4().hex
            set_request_id(rid)
            start = time.perf_counter()

            request_body: str | None = None
            try:
                raw = await request.body()
                if raw:
                    request_body = raw.decode("utf-8", errors="replace")[:MAX_BODY_CAPTURE]
            except Exception:
                logger.debug("failed to read request body", exc_info=True)

            try:
                response = await call_next(request)
                status_code = response.status_code
            except Exception as exc:
                status_code = 500
                error_entry = TracedError(
                    id=uuid.uuid4().hex,
                    parent_request_id=rid,
                    timestamp=time.time() * 1_000,
                    name=type(exc).__name__,
                    message=str(exc),
                    stack=traceback.format_exc(),
                )
                registry.error_store.add(error_entry)
                registry.bus.emit(CHANNEL_TELEMETRY_ERROR, error_entry)
                raise

            duration_ms = (time.perf_counter() - start) * 1_000

            response_body: str | None = None
            response_size = 0
            try:
                chunks: list[bytes] = []
                async for chunk in response.body_iterator:
                    if isinstance(chunk, str):
                        chunks.append(chunk.encode("utf-8"))
                    else:
                        chunks.append(chunk)
                body_bytes = b"".join(chunks)
                response_size = len(body_bytes)

                if not is_static(path):
                    response_body = body_bytes.decode("utf-8", errors="replace")[:MAX_BODY_CAPTURE]

                from starlette.responses import Response as StarletteResponse
                response = StarletteResponse(
                    content=body_bytes,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
            except Exception:
                logger.debug("failed to capture response body", exc_info=True)

            entry = TracedRequest(
                id=rid,
                method=request.method,
                url=path,
                status_code=status_code,
                duration_ms=round(duration_ms, 2),
                timestamp=time.time() * 1_000,
                headers=sanitize_headers(dict(request.headers)),
                response_headers=sanitize_headers(dict(response.headers)),
                request_body=request_body,
                response_body=response_body,
                response_size=response_size,
                is_static=is_static(path),
            )

            registry.request_store.add(entry)
            registry.bus.emit(CHANNEL_REQUEST_COMPLETED, entry)
            clear_request_id()
            return response

    app.add_middleware(BrakitMiddleware)
