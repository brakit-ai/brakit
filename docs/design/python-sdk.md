# Python SDK

Zero-dependency telemetry capture for Flask and FastAPI. Forwards to the Node.js core.

## Activation

```
import brakit → _auto_setup():
  1. Skip if prod/CI/cloud/disabled     (core/guards.py)
  2. Create stores + event bus           (core/registry.py)
  3. Patch logging + urllib3             (hooks/)
  4. Patch SQLAlchemy                    (adapters/)
  5. Discover Node.js port              (transport/discovery.py)
  6. Start forwarder thread             (transport/forwarder.py)
  7. Patch Flask/FastAPI.__init__        (frameworks/)
```

## Data Flow

```
Capture hooks → sanitize → EventBus → Forwarder → POST /__brakit/api/ingest → Node.js Core
```

## Structure

```
brakit/
├── _setup.py                  Initialization orchestrator
├── constants/                 Split by concern (limits, transport, routes, network, events, patterns, logger)
├── core/
│   ├── event_bus.py           Pub/sub: on(), off(), emit()
│   ├── circuit_breaker.py     Trips after 10 failures, half-open recovery after 30s
│   ├── context.py             ContextVar request-ID (async-safe)
│   ├── guards.py              Environment detection (prod/CI/cloud)
│   ├── registry.py            ServiceRegistry dataclass (DI)
│   └── sanitize.py            Mask sensitive headers + URL params
├── types/                     Frozen dataclasses: TracedRequest, TracedFetch, TracedLog, TracedError, TracedQuery
├── store/                     TelemetryStore[T] ring buffer (deque, maxlen=1000) with on_entry()/off_entry()
├── hooks/                     urllib3 monkey-patch, root logger handler
├── adapters/                  SQLAlchemy engine events, DBAdapter protocol
├── frameworks/                Flask before/after_request, FastAPI middleware, FrameworkAdapter protocol
└── transport/                 Port discovery (.brakit/port walk), Forwarder (daemon thread, batching)
```

## Key Rules

- **All adapter state is class variables**, not instance variables. Instances are throwaway.
- **All hooks are non-fatal.** Every patch is wrapped in try/except. A failure never crashes the app.
- **Sensitive data is masked at the capture point**, before it enters stores or the event bus.
- **Stores are bounded.** Ring buffers evict oldest entries. No unbounded memory growth.
- **Constants live in `constants/`**, one file per concern. Barrel re-export in `__init__.py` for backward compat.

## Security

| Data | Protection |
|------|-----------|
| Headers (Authorization, Cookie, etc.) | Masked via `sanitize_headers()` |
| URL query params (token, key, secret) | Masked via `sanitize_url()` |
| Request/response bodies | Truncated to 10KB |
| SQL | Truncated to 2KB |
| Production environments | 7-layer guard: BRAKIT_DISABLE, prod env vars, CI signals, cloud signals, circuit breaker, daemon thread, non-fatal hooks |

## Extending

**New framework:** Implement `FrameworkAdapter` protocol (`_protocol.py`), register in `frameworks/__init__.py`.

**New DB adapter:** Implement `DBAdapter` protocol (`_protocol.py`), register in `adapters/__init__.py`.

**New telemetry type:** Add frozen dataclass in `types/` → new store extending `TelemetryStore[T]` → channel constant in `constants/events.py` → wire in `_setup.py`.

## Why

| Choice | Why |
|--------|-----|
| Zero deps | No version conflicts. Pure stdlib. |
| Monkey-patching | Zero-config: `import brakit` is the entire API. |
| Class-var patch state | Adapter instances are discarded after detection. |
| Ring buffers | Bounded memory regardless of traffic. |
| Frozen dataclasses | Thread-safe, immutable traced data. |
| Sanitize at capture | No sensitive data flows through the system. |
