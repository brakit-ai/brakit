"""Integration tests for Flask middleware."""
from __future__ import annotations

from brakit.constants.headers import BRAKIT_REQUEST_ID_HEADER
from brakit.core.event_bus import EventBus
from brakit.core.registry import ServiceRegistry
from brakit.frameworks.flask import FlaskAdapter
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
    from flask import Flask

    # Unpatch first to avoid state leaking between tests
    FlaskAdapter().unpatch()
    FlaskAdapter._patched = False  # type: ignore[attr-defined]

    adapter = FlaskAdapter()
    adapter.patch(registry)

    app = Flask(__name__)

    @app.route("/hello")
    def hello():  # type: ignore[no-untyped-def]
        return "world"

    @app.route("/error")
    def error_route():  # type: ignore[no-untyped-def]
        raise RuntimeError("test error")

    @app.route("/post", methods=["POST"])
    def post_route():  # type: ignore[no-untyped-def]
        from flask import request
        return f"got: {request.get_data(as_text=True)}"

    return app


def test_captures_get_request() -> None:
    registry = _make_registry()
    app = _make_app(registry)
    with app.test_client() as client:
        resp = client.get("/hello")
    assert resp.status_code == 200
    requests = registry.request_store.get_all()
    assert len(requests) == 1
    assert requests[0].method == "GET"
    assert requests[0].url == "/hello"
    assert requests[0].status_code == 200


def test_captures_post_with_body() -> None:
    registry = _make_registry()
    app = _make_app(registry)
    with app.test_client() as client:
        resp = client.post("/post", data="hello body")
    assert resp.status_code == 200
    requests = registry.request_store.get_all()
    assert len(requests) == 1
    assert requests[0].request_body == "hello body"


def test_captures_response_body() -> None:
    registry = _make_registry()
    app = _make_app(registry)
    with app.test_client() as client:
        client.get("/hello")
    requests = registry.request_store.get_all()
    assert requests[0].response_body == "world"


def test_captures_error_on_exception() -> None:
    registry = _make_registry()
    app = _make_app(registry)
    app.config["TESTING"] = True
    app.config["PROPAGATE_EXCEPTIONS"] = False
    with app.test_client() as client:
        resp = client.get("/error")
    assert resp.status_code == 500
    errors = registry.error_store.get_all()
    assert len(errors) == 1
    assert errors[0].name == "RuntimeError"
    assert "test error" in errors[0].message


def test_cross_service_uses_propagated_id() -> None:
    registry = _make_registry()
    app = _make_app(registry)
    with app.test_client() as client:
        client.get("/hello", headers={BRAKIT_REQUEST_ID_HEADER: "parent-id-123"})
    # When propagated, no TracedRequest should be emitted (parent already exists)
    requests = registry.request_store.get_all()
    assert len(requests) == 0


def test_standalone_generates_own_id() -> None:
    registry = _make_registry()
    app = _make_app(registry)
    with app.test_client() as client:
        client.get("/hello")
    requests = registry.request_store.get_all()
    assert len(requests) == 1
    assert len(requests[0].id) > 0
