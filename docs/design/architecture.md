# How Brakit Works

Brakit is a developer tool that shows you what your API does at runtime — every
HTTP request, database query, fetch call, console log, and error — without
changing your code. This document explains how it does that.

## Table of contents

- [The big idea](#the-big-idea)
- [Core principles](#core-principles)
- [Key concepts](#key-concepts)
- [How setup works](#how-setup-works)
- [Request capture](#request-capture)
- [The adapter system](#the-adapter-system)
- [Event routing](#event-routing)
- [Data storage](#data-storage)
- [The analysis engine](#the-analysis-engine)
- [The dashboard](#the-dashboard)
- [MCP server](#mcp-server)
- [Safety guarantees](#safety-guarantees)
- [Design decisions](#design-decisions)
- [Build output](#build-output)
- [Framework detection](#framework-detection)
- [Supporting other languages](#supporting-other-languages)
- [Extending brakit](#extending-brakit)

---

## The big idea

When you add `import 'brakit'` to your app (or use the CLI), brakit hooks into
your HTTP server from inside the same process. It intercepts every request and
response, captures internal activity — database queries, fetch calls, console
output, errors — and serves a live dashboard at `/__brakit`.

```
┌──────────┐     ┌─────────────────────────────────────┐
│          │     │  Your HTTP Server                   │
│  Browser ├────>│                                     │
│          │<────┤  ┌─────────────────────────────┐    │
│          │     │  │  Brakit (in-process)        │    │
└──────────┘     │  │                             │    │
                 │  │  Interceptor --> Capture    │    │
                 │  │       |                     │    │
                 │  │       v                     │    │
                 │  │  Stores (reqs, queries...)  │    │
                 │  │       |                     │    │
                 │  │       v                     │    │
                 │  │  Analysis --> Dashboard     │    │  ┌───────────┐
                 │  │       |                     │    │  │           │
                 │  │       v                     │    │  │  AI Agent │
                 │  │  MCP Server <───────────────│────│──│  (Claude, │
                 │  │                             │    │  │   Cursor) │
                 │  └─────────────────────────────┘    │  │           │
                 │                                     │  └───────────┘
                 │  Your route handlers, middleware    │
                 └─────────────────────────────────────┘
```

Everything runs in a single process. No proxy, no separate server, no port
forwarding. Brakit patches `http.Server.prototype.emit` so it sees every
request the moment Node.js receives it.

---

## Core principles

Three rules that every brakit module follows:

1. **Never break the application.** Every monkey-patch is wrapped with `safeWrap` so that if brakit throws, the original function runs as if brakit wasn't there. A circuit breaker disables brakit entirely if too many errors occur. See [Safety Guarantees](safety.md) for the full 5-layer system.

2. **Single process, zero config.** Brakit runs inside your HTTP server — no proxy, no sidecar, no separate port. `import 'brakit'` is the entire setup. This constraint means all inter-module communication happens via function calls (through the EventBus), not HTTP or IPC.

3. **Extend by adding, not modifying.** New database adapters, security rules, insight rules, and MCP tools are each one file implementing one interface. Adding a Drizzle adapter doesn't touch the analysis engine. Adding a new security rule doesn't touch the adapters.

---

## Key concepts

| Term | What it means |
|------|--------------|
| **Telemetry event** | A captured piece of runtime data — a fetch call, database query, console log, or error |
| **Channel** | A typed event bus topic (e.g., `telemetry:fetch`). Producers emit, consumers subscribe |
| **Service** | A named dependency in the ServiceRegistry (e.g., `"query-store"`, `"event-bus"`) |
| **Store** | A bounded in-memory collection of telemetry entries. Evicts oldest when full |
| **Adapter** | A plugin that monkey-patches a database library to capture queries |
| **Insight** | A performance observation computed by the analysis engine (e.g., "N+1 queries detected") |
| **Finding** | A security issue detected in live traffic (e.g., "password field exposed in response") |
| **Flow** | A group of related requests representing a single user action |

---

## How setup works

When `import 'brakit'` runs, three things happen in order:

### 1. Activation check

`src/runtime/activate.ts` decides whether to activate. Brakit stays dormant in
production, staging, CI, and cloud environments. You can also disable it with
`BRAKIT_DISABLE=true`.

### 2. Instrumentation hooks

`src/runtime/setup.ts` creates the core primitives (EventBus, ServiceRegistry),
instantiates all stores, registers them, and wires up the capture pipeline:

- **Fetch hook** — Uses Node.js `diagnostics_channel` to capture every
  outgoing `fetch()` call. Emits `telemetry:fetch` on the bus.
- **Console hook** — Wraps `console.log`, `console.warn`, `console.error`.
  Emits `telemetry:log` on the bus.
- **Error hook** — Listens for uncaught exceptions and unhandled rejections.
  Emits `telemetry:error` on the bus.
- **Database adapters** — Auto-detects installed database libraries and
  monkey-patches them to capture queries (see "The adapter system" below).
  Emits `telemetry:query` on the bus.

### 3. HTTP interceptor

`src/runtime/interceptor.ts` patches `http.Server.prototype.emit` using
`safeWrap` — a safety wrapper that falls back to the original if brakit throws.

For every incoming request:

1. Generate a unique `requestId` (UUID).
2. If the URL starts with `/__brakit`, serve the dashboard (localhost only).
3. Otherwise, wrap the request in an `AsyncLocalStorage` context carrying the
   `requestId`, and hook `res.write()`/`res.end()` to capture the response body.
4. Call the original handler — your app runs normally.

The `requestId` propagates through the entire async call stack. When a database
adapter fires inside that request, `AsyncLocalStorage` tells it which request
it belongs to. This is how brakit correlates "this request fired 4 database
queries" without any HTTP headers or external communication.

---

## Request capture

`src/runtime/capture.ts` hooks `res.write()` and `res.end()` to buffer
response chunks. When the response finishes:

1. Decompress the body if gzip/brotli/deflate encoded.
2. Store the complete request record (method, URL, headers, status, body,
   timing) in the RequestStore.

All timing is measured with `performance.now()` to avoid clock drift, and
decompression happens after timing measurement so it doesn't inflate response
duration numbers.

---

## The adapter system

Different projects use different database libraries — pg, mysql2, Prisma, and
so on. Brakit uses a plugin system where each library gets its own adapter.

Each adapter answers three questions:

1. **Is this library installed?** Check if the package exists in the user's
   `node_modules`. If not, skip it.
2. **How do I capture its queries?** Monkey-patch the library's internal methods
   to record what's happening.
3. **How do I clean up?** Optionally restore the original methods.

```typescript
interface BrakitAdapter {
  name: string; // "pg", "mysql2", "prisma", etc.
  detect(): boolean; // Is the library installed?
  patch(emit): void; // Start capturing queries
  unpatch?(): void; // Stop capturing (optional)
}
```

### The adapter registry

On startup, brakit creates a registry of all known adapters. It calls
`detect()` on each one, and only `patch()`es the ones that are actually
installed. If one adapter fails (maybe the library changed its API between
versions), the others still work.

Currently, brakit ships with three adapters:

| Adapter | Library           | What it patches                                  |
| ------- | ----------------- | ------------------------------------------------ |
| pg      | `pg` (PostgreSQL) | `Client.prototype.query`                         |
| mysql2  | `mysql2`          | `Connection.prototype.query` and `.execute`      |
| prisma  | `@prisma/client`  | Injects a Prisma client extension via `$extends` |

### Normalization

Every adapter translates its library's output into a common format. Regardless
of whether a query came from pg, mysql2, or Prisma, the analysis engine sees
the same fields:

- **operation** — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `OTHER`
- **table** — The table or model being queried
- **duration** — How long it took, in milliseconds

The analysis code never needs to know which database library you're using.

---

## Event routing

All captured events flow through a typed EventBus:

```
Hooks/Adapters → bus.emit("telemetry:*") → stores (via bus.on in setup.ts)
                                          → SSE handler (via bus.on)
                                          → analysis engine (triggers recompute)

Analysis Engine → bus.emit("analysis:updated") → SSE handler
                                                → terminal display
```

The EventBus (`src/core/event-bus.ts`) provides typed publish-subscribe
channels. Adding a new telemetry type means adding one line to the `ChannelMap`
interface — TypeScript enforces correct payloads at every call site, and no
switch-case routing is needed.

Events are routed directly via function calls — no HTTP transport, no
serialization. This is possible because everything runs in the same process.

See [EventBus design doc](event-bus.md) for channel naming, the full ChannelMap,
and how to add new channels.

---

## Data storage

All captured data lives in bounded in-memory arrays. No external database
required. Each store holds up to 1,000 entries and evicts the oldest when full.

| Store        | Contains                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| RequestStore | HTTP requests and responses captured in-process                                          |
| QueryStore   | Database queries from adapters                                                           |
| FetchStore   | Outgoing fetch calls                                                                     |
| LogStore     | Console output                                                                           |
| ErrorStore   | Uncaught exceptions and unhandled rejections                                             |
| MetricsStore | Per-endpoint session statistics, persisted to `.brakit/metrics.json`                     |
| IssueStore   | Stateful issue tracking with lifecycle (open/fixing/resolved/stale/regressed), persisted to `.brakit/issues.json`    |

Stores are registered in a typed ServiceRegistry and accessed through it —
no module-level singletons. The EventBus delivers new entries to all
subscribers (SSE stream, analysis engine) without polling.

See [ServiceRegistry design doc](service-registry.md) for the full ServiceMap,
registration flow, and testing patterns.

### Metrics persistence

The MetricsStore accumulates per-endpoint metrics (p95 latency, error rate,
average query count, time breakdown) and flushes to `.brakit/metrics.json`
every 30 seconds. On shutdown, it flushes synchronously. This enables
cross-session regression detection — the analysis engine compares the current
session against previous sessions to detect performance degradation.

---

## The analysis engine

The analysis engine (`src/analysis/engine.ts`) subscribes to bus channels and
recomputes whenever new data arrives (with a 300ms debounce to avoid thrashing
during burst traffic). It produces two kinds of results:

- **Security findings** — 8 rules scanning live traffic for real vulnerabilities (exposed secrets, stack trace leaks, insecure cookies, etc.)
- **Performance insights** — 13 rules detecting performance patterns (N+1 queries, slow endpoints, large responses, regressions, etc.)

Each rule is one file implementing a single interface. The analysis engine
pre-computes shared indexes (queries grouped by request, endpoint aggregations)
so rules focus on detection logic, not data wrangling.

See [Analysis Engine](analysis-engine.md) for the full rule tables, the
recompute cycle, PreparedInsightContext, finding lifecycle, and how to add new
rules.

---

## The dashboard

The dashboard is a self-contained HTML page served at `/__brakit`. All
JavaScript and CSS are inlined — no external requests, no CDN, no asset loading.

Real-time updates use Server-Sent Events (SSE). When brakit captures a new
request or a database adapter reports a query, the dashboard updates instantly
without polling. The SSE handler subscribes to bus channels and streams events
as they arrive.

The dashboard is only served to localhost — requests from non-local IPs get a 404.

See [Dashboard](dashboard.md) for the full route table, API endpoints, SSE
event types, client architecture, and security measures.

---

## MCP server

Brakit exposes its findings and performance data to AI assistants (Claude,
Cursor, Copilot) through the Model Context Protocol. The MCP server runs as a
separate process and connects to your running app through the same dashboard
API that powers the browser UI.

It discovers your app by reading the `.brakit/port` file, then provides 6
tools that let AI assistants query findings, inspect endpoints, drill into
request details, and verify fixes. A finding lifecycle system tracks issues
as they move through `open → fixing → resolved`, with persistence across
app restarts.

See [MCP documentation](mcp.md) for the full protocol reference, tool
descriptions, finding lifecycle details, and how to add new tools.

---

## Safety guarantees

Brakit runs inside your process. If it throws, your app could crash. Five layers
prevent this:

1. **Activation guards** — Dormant in production, staging, CI, and cloud environments
2. **safeWrap** — Every monkey-patch falls back to the original on throw
3. **Circuit breaker** — Too many errors → brakit disables itself for the session
4. **Bounded stores** — Memory capped, oldest entries evicted
5. **Silent failures** — Capture errors swallowed, never surface to your app

See [Safety Guarantees](safety.md) for how each layer works, code examples, and
what to do if brakit interferes.

---

## Design decisions

**Why in-process, not a proxy?** A proxy adds latency to every request, requires
port forwarding, and can't see internal state (which request triggered which
query). In-process means zero latency overhead, automatic request-query
correlation via `AsyncLocalStorage`, and no network configuration.

**Why EventBus, not direct callbacks?** Direct callbacks between modules create
hidden dependencies (the SSE handler importing 5 stores). The bus inverts this:
modules subscribe to channels without knowing who emits. Adding a new telemetry
type doesn't require changing existing consumers.

**Why ServiceRegistry, not module singletons?** Singletons are impossible to
mock without `jest.mock()`, create implicit initialization order, and hide
dependencies. The registry makes every dependency explicit, testable, and
traceable.

**Why bounded in-memory stores, not a database?** Brakit is a zero-config dev
tool. Requiring a database (even SQLite) adds setup friction. Bounded arrays
with oldest-eviction give predictable memory usage without configuration. The
MetricsStore and IssueStore persist to JSON files for cross-session features
(regression detection, issue lifecycle): everything else is ephemeral.

**Why debounced analysis, not real-time?** A single request can generate 20+
telemetry events (queries, fetches, logs). Recomputing insights on every event
would thrash the CPU. The 300ms debounce batches events and recomputes once
after the burst settles.

---

## Build output

Brakit builds four files:

| File                    | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `dist/api.js`           | Public API — for programmatic use or CI integration |
| `dist/bin/brakit.js`    | The CLI you run with `npx brakit`                   |
| `dist/runtime/index.js` | The runtime entry point for `import 'brakit'`       |
| `dist/mcp/server.js`    | MCP server for AI tool integration                  |

Database drivers (pg, mysql2, @prisma/client) are **not** bundled. The adapters
load them from your project's `node_modules` at runtime. This is essential —
the adapter needs to patch the exact same module instance your code imports.

---

## Framework detection

Brakit reads your `package.json` and looks for known framework dependencies to
figure out how to start your dev server when using the CLI:

| Dependency       | Framework | Dev command               |
| ---------------- | --------- | ------------------------- |
| `next`           | Next.js   | `next dev --port <port>`  |
| `@remix-run/dev` | Remix     | `remix dev`               |
| `nuxt`           | Nuxt      | `nuxt dev --port <port>`  |
| `vite`           | Vite      | `vite --port <port>`      |
| `astro`          | Astro     | `astro dev --port <port>` |

When using the in-process `import 'brakit'` approach, framework detection is
not needed — brakit hooks into whatever HTTP server your app creates.

---

## Supporting other languages

For non-Node.js backends, brakit exposes an HTTP ingest endpoint that any
language can POST events to:

```
POST http://localhost:<PORT>/__brakit/api/ingest
```

```json
{
  "_brakit": true,
  "version": 1,
  "sdk": "brakit-python/0.1.0",
  "events": [
    {
      "type": "db.query",
      "requestId": "uuid",
      "timestamp": 1708000000000,
      "data": {
        "operation": "SELECT",
        "table": "users",
        "duration": 45,
        "source": "django-orm"
      }
    }
  ]
}
```

A language SDK needs to: (1) generate or propagate a request ID, (2) wrap
database calls to capture timing, and (3) POST events to the ingest endpoint.
The stores, analysis engine, and dashboard are completely reused.

---

## Extending brakit

The architecture is designed around five extension points:

1. **New database adapter** — One file implementing `BrakitAdapter`. See
   [CONTRIBUTING.md](../../CONTRIBUTING.md) for a step-by-step guide.

2. **New security rule** — One file implementing `SecurityRule`. The scanner
   picks it up automatically.

3. **New insight rule** — One file implementing `InsightRule`. Detects
   performance patterns using pre-computed request and query indexes.

4. **New language SDK** — POST events to the ingest endpoint. No changes to
   brakit itself.

5. **New MCP tool** — One file implementing `McpTool`, registered in the tool
   map. See [MCP documentation](mcp.md).

Each extension point is isolated. Adding a Drizzle adapter doesn't touch the
analysis engine. Adding a new security rule doesn't touch the adapters. Adding
a new insight rule doesn't touch the security scanner. Building a Python SDK
doesn't require any changes to the Node.js codebase.
