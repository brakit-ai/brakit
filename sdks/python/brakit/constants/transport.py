"""Transport and forwarding configuration."""
from __future__ import annotations

# Flush when 20 events have accumulated. Balances between latency (smaller =
# faster delivery) and overhead (larger = fewer HTTP round-trips).
BATCH_SIZE: int = 20

# Flush every 100ms regardless of batch size, ensuring events appear in the
# dashboard within ~100ms even under low traffic.
FLUSH_INTERVAL_S: float = 0.1

TRANSPORT_TIMEOUT_S: int = 2
MAX_QUEUE_SIZE: int = 10_000

# Retry port discovery 30 times at 0.5s intervals (total ~15s). The Node.js
# server writes its port file on first request, which typically happens within
# a few seconds of startup.
PORT_RETRY_COUNT: int = 30
PORT_RETRY_INTERVAL_S: float = 0.5
