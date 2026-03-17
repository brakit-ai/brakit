"""Tests for SQL normalization (operation + table extraction) and noise filtering."""
from __future__ import annotations

from brakit.adapters._normalize import is_noise_query, normalize_sql


def test_select_with_table() -> None:
    op, table = normalize_sql("SELECT * FROM users WHERE id = 1")
    assert op == "SELECT"
    assert table == "users"


def test_insert_with_table() -> None:
    op, table = normalize_sql("INSERT INTO orders (name) VALUES ('test')")
    assert op == "INSERT"
    assert table == "orders"


def test_update_with_table() -> None:
    op, table = normalize_sql("UPDATE products SET price = 10 WHERE id = 1")
    assert op == "UPDATE"
    assert table == "products"


def test_delete_with_table() -> None:
    op, table = normalize_sql("DELETE FROM sessions WHERE expired = true")
    assert op == "DELETE"
    assert table == "sessions"


def test_unknown_operation_returns_other() -> None:
    op, table = normalize_sql("CREATE TABLE foo (id INT)")
    assert op == "OTHER"


def test_empty_string() -> None:
    op, table = normalize_sql("")
    assert op == "OTHER"
    assert table == ""


def test_case_insensitive() -> None:
    op, table = normalize_sql("select * from Users")
    assert op == "SELECT"
    assert table == "Users"


def test_join_extracts_first_table() -> None:
    op, table = normalize_sql("SELECT * FROM users JOIN orders ON users.id = orders.user_id")
    assert op == "SELECT"
    assert table == "users"


# -- is_noise_query tests --------------------------------------------------


def test_noise_transaction_begin() -> None:
    assert is_noise_query("BEGIN") is True


def test_noise_transaction_commit() -> None:
    assert is_noise_query("COMMIT") is True


def test_noise_transaction_rollback() -> None:
    assert is_noise_query("ROLLBACK") is True


def test_noise_savepoint() -> None:
    assert is_noise_query("SAVEPOINT sp1") is True


def test_noise_release_savepoint() -> None:
    assert is_noise_query("RELEASE SAVEPOINT sp1") is True


def test_noise_pg_catalog_introspection() -> None:
    assert is_noise_query("SELECT * FROM pg_catalog.pg_type") is True


def test_noise_set_command() -> None:
    assert is_noise_query("SET search_path TO public") is True


def test_noise_select_public_probe() -> None:
    assert is_noise_query("select public") is True


def test_noise_case_insensitive_transaction() -> None:
    assert is_noise_query("  BEGIN ; ") is True


def test_not_noise_select_from_public_schema() -> None:
    assert is_noise_query("SELECT public.id FROM public.contact_submissions") is False


def test_not_noise_select() -> None:
    assert is_noise_query("SELECT * FROM users") is False


def test_not_noise_insert() -> None:
    assert is_noise_query("INSERT INTO orders (name) VALUES ('test')") is False


def test_not_noise_update() -> None:
    assert is_noise_query("UPDATE products SET price = 10") is False
