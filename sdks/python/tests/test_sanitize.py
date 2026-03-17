"""Tests for header/URL sanitization."""
from __future__ import annotations

from brakit.core.sanitize import sanitize_headers, sanitize_stack_trace, sanitize_url


def test_masks_authorization() -> None:
    h = sanitize_headers({"Authorization": "Bearer secret-token-12345"})
    assert h["Authorization"] != "Bearer secret-token-12345"
    assert "****" in h["Authorization"] or "..." in h["Authorization"]


def test_masks_cookie() -> None:
    h = sanitize_headers({"cookie": "session=abc123"})
    assert h["cookie"] != "session=abc123"


def test_preserves_non_sensitive() -> None:
    h = sanitize_headers({"Content-Type": "application/json", "Accept": "*/*"})
    assert h == {"Content-Type": "application/json", "Accept": "*/*"}


def test_masks_x_api_key() -> None:
    h = sanitize_headers({"x-api-key": "my-secret-key"})
    assert h["x-api-key"] != "my-secret-key"


def test_sanitize_url_masks_token_param() -> None:
    url = sanitize_url("https://api.example.com/data?token=secret123&page=1")
    assert "secret123" not in url
    assert "page=1" in url


def test_sanitize_url_masks_password_param() -> None:
    url = sanitize_url("https://api.example.com/data?password=hunter2")
    assert "hunter2" not in url


def test_sanitize_url_preserves_non_sensitive() -> None:
    url = sanitize_url("https://api.example.com/data?page=1&limit=10")
    assert url == "https://api.example.com/data?page=1&limit=10"


def test_sanitize_url_no_query_string() -> None:
    url = sanitize_url("https://api.example.com/data")
    assert url == "https://api.example.com/data"


def test_empty_headers() -> None:
    assert sanitize_headers({}) == {}


# -- sanitize_stack_trace tests ---------------------------------------------


def test_sanitize_stack_trace_masks_db_url() -> None:
    trace = (
        'File "app.py", line 5\n'
        '  engine = create_engine("postgresql://admin:s3cret@host/db")\n'
    )
    result = sanitize_stack_trace(trace)
    assert "s3cret" not in result
    assert "admin" not in result
    assert "****:****@host" in result


def test_sanitize_stack_trace_masks_mysql_url() -> None:
    trace = 'mysql://root:password@localhost:3306/mydb\n'
    result = sanitize_stack_trace(trace)
    assert "password" not in result
    assert "root" not in result


def test_sanitize_stack_trace_preserves_non_credential_text() -> None:
    trace = 'File "app.py", line 10, in main\n    raise ValueError("bad")\n'
    assert sanitize_stack_trace(trace) == trace
