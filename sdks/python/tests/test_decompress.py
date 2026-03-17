"""Tests for response body decompression."""
from __future__ import annotations

import gzip
import zlib

from brakit.core.decompress import decompress_body


def test_gzip_decompression() -> None:
    original = b"Hello, world!"
    compressed = gzip.compress(original)
    assert decompress_body(compressed, "gzip") == original


def test_deflate_decompression() -> None:
    original = b"Hello, world!"
    compressed = zlib.compress(original)
    assert decompress_body(compressed, "deflate") == original


def test_no_encoding_returns_original() -> None:
    data = b"plain text"
    assert decompress_body(data, None) == data
    assert decompress_body(data, "") == data


def test_unknown_encoding_returns_original() -> None:
    data = b"some data"
    assert decompress_body(data, "unknown-encoding") == data


def test_empty_body_returns_empty() -> None:
    assert decompress_body(b"", "gzip") == b""


def test_invalid_gzip_returns_original() -> None:
    data = b"not gzip data"
    assert decompress_body(data, "gzip") == data
