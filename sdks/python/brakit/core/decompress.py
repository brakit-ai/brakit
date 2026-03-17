"""Decompress response bodies based on Content-Encoding header."""
from __future__ import annotations

import gzip
import zlib

from brakit.constants.encoding import ENCODING_BROTLI, ENCODING_DEFLATE, ENCODING_GZIP


def decompress_body(body: bytes, content_encoding: str | None) -> bytes:
    """Decompress *body* according to the Content-Encoding header value.

    Returns the original bytes on failure or when the encoding is unknown.
    """
    if not content_encoding or not body:
        return body

    encoding = content_encoding.lower().strip()

    try:
        if encoding == ENCODING_GZIP:
            return gzip.decompress(body)
        if encoding == ENCODING_DEFLATE:
            return zlib.decompress(body)
        if encoding == ENCODING_BROTLI:
            try:
                import brotli  # type: ignore[import-untyped]
                return brotli.decompress(body)  # type: ignore[no-any-return]
            except ImportError:
                return body
    except Exception:
        return body

    return body
