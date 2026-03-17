"""Capture and storage limits."""
from __future__ import annotations

MAX_STORE_ENTRIES: int = 1_000
MAX_BODY_CAPTURE: int = 10_240
MAX_SQL_LENGTH: int = 2_000
MAX_HEALTH_ERRORS: int = 10

# Bounded capacity for the async task -> request-ID lookup dict. Prevents
# unbounded memory growth if tasks are never cleaned up.
MAX_TASK_CONTEXT_ENTRIES: int = 2_000

# Sanitization: minimum header value length before masking, and how many
# leading characters to leave visible in the masked output.
MASK_MIN_LENGTH: int = 8
MASK_VISIBLE_CHARS: int = 4
