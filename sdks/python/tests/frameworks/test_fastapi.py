"""Integration tests for FastAPI ASGI middleware."""
from __future__ import annotations

from brakit.constants.headers import BRAKIT_REQUEST_ID_HEADER
from brakit.core.event_bus import EventBus
from brakit.core.registry import ServiceRegistry
from brakit.frameworks.fastapi import FastAPIAdapter
from brakit.store.error_store import ErrorStore
from brakit.store.fetch_store import FetchStore
from brakit.store.log_store import LogStore
from brakit.store.query_store import QueryStore
from brakit.store.request_store import RequestStore


def _make_registry() -> ServiceRegistry:
    return ServiceRegistry(
        bus=EventBus(),
        request_store=RequestStore(),
        query_store=QueryStore(),
        fetch_store=FetchStore(),
        log_store=LogStore(),
        error_store=ErrorStore(),
    )


def _make_app(registry: ServiceRegistry):  # type: ignore[no-untyped-def]
    from fastapi import FastAPI
    from pydantic import BaseModel

    # Unpatch first to avoid state leaking between tests
    FastAPIAdapter().unpatch()
    FastAPIAdapter._patched = False  # type: ignore[attr-defined]

    adapter = FastAPIAdapter()
    adapter.patch(registry)

    app = FastAPI()

    @app.get("/hello")
    async def hello():  # type: ignore[no-untyped-def]
        return {"message": "world"}

    class Item(BaseModel):
        name: str
        price: float

    @app.post("/items")
    async def create_item(item: Item):  # type: ignore[no-untyped-def]
        return item

    @app.get("/error")
    async def error_route():  # type: ignore[no-untyped-def]
        raise RuntimeError("test error")

    return app


def test_captures_async_request() -> None:
    from starlette.testclient import TestClient

    registry = _make_registry()
    app = _make_app(registry)
    with TestClient(app) as client:
        resp = client.get("/hello")
    assert resp.status_code == 200
    requests = registry.request_store.get_all()
    assert len(requests) == 1
    assert requests[0].method == "GET"
    assert requests[0].url == "/hello"
    assert requests[0].status_code == 200


def test_captures_response_body() -> None:
    from starlette.testclient import TestClient

    registry = _make_registry()
    app = _make_app(registry)
    with TestClient(app) as client:
        client.get("/hello")
    requests = registry.request_store.get_all()
    assert requests[0].response_body is not None
    assert "world" in requests[0].response_body


def test_captures_422_validation_error() -> None:
    from starlette.testclient import TestClient

    registry = _make_registry()
    app = _make_app(registry)
    with TestClient(app) as client:
        resp = client.post("/items", json={"invalid": "data"})
    assert resp.status_code == 422
    requests = registry.request_store.get_all()
    assert len(requests) == 1
    assert requests[0].status_code == 422
    assert requests[0].response_body is not None


def test_cross_service_uses_propagated_id() -> None:
    from starlette.testclient import TestClient

    registry = _make_registry()
    app = _make_app(registry)
    with TestClient(app) as client:
        client.get("/hello", headers={BRAKIT_REQUEST_ID_HEADER: "parent-id-456"})
    # When propagated, no TracedRequest should be emitted
    requests = registry.request_store.get_all()
    assert len(requests) == 0


def test_standalone_generates_own_id() -> None:
    from starlette.testclient import TestClient

    registry = _make_registry()
    app = _make_app(registry)
    with TestClient(app) as client:
        client.get("/hello")
    requests = registry.request_store.get_all()
    assert len(requests) == 1
    assert len(requests[0].id) > 0
