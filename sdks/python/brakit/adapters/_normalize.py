"""SQL normalization: operation detection, table extraction, noise filtering."""
from __future__ import annotations

import re

from brakit.types.telemetry import NormalizedOp

_OP_PATTERN = re.compile(
    r"^\s*(SELECT|INSERT|UPDATE|DELETE)\b",
    re.IGNORECASE,
)

_TABLE_PATTERN = re.compile(
    r"(?:FROM|INTO|UPDATE|JOIN)\s+[\"'`]?(?:\w+\.)?[\"'`]?(\w+)",
    re.IGNORECASE,
)

_VALID_OPS: dict[str, NormalizedOp] = {
    "SELECT": "SELECT",
    "INSERT": "INSERT",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE",
}

# Transaction-management statements emitted by ORMs / drivers, not user queries.
_TRANSACTION_PREFIXES: tuple[str, ...] = (
    "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE SAVEPOINT",
)

# Substrings that identify asyncpg/psycopg driver-internal type introspection.
_INTERNAL_QUERY_MARKERS: tuple[str, ...] = ("pg_catalog",)

# Exact prefixes for driver probe/setup queries (e.g. asyncpg search_path probe).
_INTERNAL_EXACT_PREFIXES: tuple[str, ...] = ("set ",)

# Exact strings for driver probe queries (e.g. asyncpg "select public" search_path check).
_INTERNAL_EXACT_QUERIES: tuple[str, ...] = ("select public",)


def normalize_sql(sql: str) -> tuple[NormalizedOp, str]:
    op: NormalizedOp = "OTHER"
    table = ""

    op_match = _OP_PATTERN.match(sql)
    if op_match:
        op = _VALID_OPS.get(op_match.group(1).upper(), "OTHER")

    table_match = _TABLE_PATTERN.search(sql)
    if table_match:
        table = table_match.group(1)

    return op, table


def is_noise_query(sql: str) -> bool:
    """Return True for transaction management, driver-internal, and setup queries.

    Centralises noise filtering so all database adapters share a single
    definition of what constitutes a non-application query.
    """
    stripped = sql.strip()
    upper = stripped.rstrip(";").upper()

    for prefix in _TRANSACTION_PREFIXES:
        if upper == prefix or upper.startswith(prefix + " "):
            return True

    low = stripped.lower()

    if low.startswith("select") and any(m in low for m in _INTERNAL_QUERY_MARKERS):
        return True

    for prefix in _INTERNAL_EXACT_PREFIXES:
        if low.startswith(prefix):
            return True

    # Strip trailing semicolons before exact comparison.
    bare = low.rstrip(";").rstrip()
    if bare in _INTERNAL_EXACT_QUERIES:
        return True

    return False
