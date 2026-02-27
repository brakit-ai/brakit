# How Brakit Works

Brakit is a developer tool that shows you what your API does at runtime — every
HTTP request, database query, fetch call, console log, and error — without
changing your code. This document explains how it does that.

## Table of contents

- [The big idea](#the-big-idea)
- [How setup works](#how-setup-works)
- [Request capture](#request-capture)
- [The adapter system](#the-adapter-system)
- [Event routing](#event-routing)
- [Data storage](#data-storage)
- [The analysis engine](#the-analysis-engine)
- [The dashboard](#the-dashboard)
- [MCP server](#mcp-server)
- [Safety guarantees](#safety-guarantees)
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

## How setup works

When `import 'brakit'` runs, three things happen in order:

### 1. Activation check

`src/runtime/activate.ts` decides whether to activate. Brakit stays dormant in
production, staging, CI, and cloud environments. You can also disable it with
`BRAKIT_DISABLE=true`.

### 2. Instrumentation hooks

`src/runtime/setup.ts` wires up the capture pipeline:

- **Fetch hook** — Uses Node.js `diagnostics_channel` to capture every
  outgoing `fetch()` call. Records URL, method, status code, and duration.
- **Console hook** — Wraps `console.log`, `console.warn`, `console.error`.
  Records every message along with which request triggered it.
- **Error hook** — Listens for uncaught exceptions and unhandled rejections.
  Records the error name, message, and stack trace.
- **Database adapters** — Auto-detects installed database libraries and
  monkey-patches them to capture queries (see "The adapter system" below).

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

All captured events flow through the same path:

```
Instrumentation hooks ──▶ setEmitter() ──▶ routeEvent() ──▶ Store
                                                              │
                                                    pub/sub notifications
                                                              │
                                              ┌───────────────┼────────────────┐
                                              ▼               ▼                ▼
                                        SSE stream    Analysis engine    Metrics store
```

Events are routed directly to stores via function calls — no HTTP transport, no
serialization. This is possible because everything runs in the same process.

---

## Data storage

All captured data lives in bounded in-memory arrays. No external database
required. Each store holds up to 1,000 entries and evicts the oldest when full.

| Store        | Contains                                                             |
| ------------ | -------------------------------------------------------------------- |
| RequestStore | HTTP requests and responses captured in-process                      |
| QueryStore   | Database queries from adapters                                       |
| FetchStore   | Outgoing fetch calls                                                 |
| LogStore     | Console output                                                       |
| ErrorStore   | Uncaught exceptions and unhandled rejections                         |
| MetricsStore | Per-endpoint session statistics, persisted to `.brakit/metrics.json` |
| FindingStore | Stateful security findings with lifecycle tracking, persisted to `.brakit/findings.json` |

Every store supports pub/sub — when a new entry is added, all subscribers are
notified. This is how the SSE stream and the analysis engine stay in sync
without polling.

### Metrics persistence

The MetricsStore accumulates per-endpoint metrics (p95 latency, error rate,
average query count, time breakdown) and flushes to `.brakit/metrics.json`
every 30 seconds. On shutdown, it flushes synchronously. This enables
cross-session regression detection — the analysis engine compares the current
session against previous sessions to detect performance degradation.

---

## The analysis engine

The analysis engine (`src/analysis/engine.ts`) subscribes to all stores and
recomputes whenever new data arrives (with a 300ms debounce to avoid thrashing
during burst traffic).

It produces two kinds of results:

### Security findings

A set of rules that scan live traffic for real security issues:

| Rule               | Severity | What it detects                                                   |
| ------------------ | -------- | ----------------------------------------------------------------- |
| Exposed secret     | Critical | Fields like `password` or `api_key` in responses with real values |
| Token in URL       | Critical | Auth tokens in query parameters instead of headers                |
| Stack trace leak   | Critical | Node.js stack traces sent to the client                           |
| Error info leak    | Critical | DB connection strings or SQL in error responses                   |
| Insecure cookie    | Warning  | Missing `HttpOnly` or `SameSite` flags                            |
| Sensitive logs     | Warning  | Passwords or tokens in console output                             |
| CORS + credentials | Warning  | `credentials: true` with wildcard origin                          |
| Response PII leak  | Warning  | Personal data (emails, phone numbers) in API responses            |

Each rule is one file in `src/analysis/rules/` implementing the `SecurityRule`
interface. The scanner automatically picks up registered rules.

### Performance insights

Modular rules in `src/analysis/insights/rules/` detect performance issues:

| Rule                   | What it detects                                                |
| ---------------------- | -------------------------------------------------------------- |
| N+1 queries            | Same query shape repeated 5+ times within one request          |
| Cross-endpoint queries | Same query appearing on >50% of endpoints                      |
| Redundant queries      | Exact same SQL fired multiple times per request                |
| Slow endpoints         | High average response time, with time breakdown (DB/Fetch/App) |
| Query-heavy endpoints  | More than 5 queries per request on average                     |
| Duplicate API calls    | Same endpoint fetched multiple times per action                |
| Error hotspots         | Endpoints with >20% error rate                                 |
| Large responses        | Average response body above 50KB                               |
| SELECT \* detection    | Queries selecting all columns                                  |
| High row counts        | Queries returning 100+ rows                                    |
| Response overfetch     | Large JSON responses with many unused fields                   |
| Regression detection   | P95 latency or query count increased vs. previous session      |

Each rule is one file implementing the `InsightRule` interface. All rules
receive a `PreparedInsightContext` with pre-computed indexes (queries grouped by
request, endpoint aggregations, etc.) so they don't duplicate work.

---

## The dashboard

The dashboard is a server-rendered HTML page served at `/__brakit`. It uses no
frontend framework — the entire client is assembled from template-literal
JavaScript functions at build time. No build step, no external dependencies.

Real-time updates use Server-Sent Events (SSE). When brakit captures a new
request or a database adapter reports a query, the dashboard updates instantly
without polling. The SSE handler (`src/dashboard/sse.ts`) subscribes to all
stores and the analysis engine, streaming events as they arrive.

The dashboard is only served to localhost — requests from non-local IPs get a 404.

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

Brakit is designed to never break your application:

- **`safeWrap`** — Every monkey-patch is wrapped so that if brakit throws, the
  original function runs instead. Your app behaves as if brakit wasn't there.
- **Circuit breaker** — If brakit encounters too many errors, it disables itself
  for the rest of the session and restores all original methods.
- **Bounded stores** — Memory usage is capped. Stores evict old entries.
- **Activation guards** — Brakit stays dormant in production, staging, CI, and
  cloud environments. It only activates in local development.
- **Empty catch blocks** — Capture failures are silently swallowed. A response
  body that can't be decompressed or a query that can't be normalized should
  never become a runtime error in your app.

---

## Build output

Brakit builds four files:

| File                    | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `dist/api.js`           | Public API — for programmatic use or CI integration |
| `dist/bin/brakit.js`    | The CLI you run with `npx brakit`                   |
| `dist/runtime/index.js` | The runtime entry point for `import 'brakit'`       |
| `dist/mcp/server.js`   | MCP server for AI tool integration                  |

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
