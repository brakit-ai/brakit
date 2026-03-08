"""SQL normalization: operation detection, table extraction."""
from __future__ import annotations

import re

from brakit.types.telemetry import NormalizedOp

_OP_PATTERN = re.compile(
    r"^\s*(SELECT|INSERT|UPDATE|DELETE)\b",
    re.IGNORECASE,
)

_TABLE_PATTERN = re.compile(
    r"(?:FROM|INTO|UPDATE|JOIN)\s+[\"'`]?(\w+)",
    re.IGNORECASE,
)

_VALID_OPS: dict[str, NormalizedOp] = {
    "SELECT": "SELECT",
    "INSERT": "INSERT",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE",
}


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
