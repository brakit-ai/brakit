# How Brakit Works

Brakit is a developer tool that shows you what your API does at runtime — every
HTTP request, database query, fetch call, console log, and error — without
changing your code. This document explains how it does that.

---

## The big idea

When you run `npx brakit dev`, two things happen:

1. Brakit starts a **proxy server** that sits between your browser and your
   dev server. Every request passes through it. Your app works exactly the same,
   but Brakit can now see every request and response.

2. Brakit starts your **dev server** with special hooks that report internal
   activity — database queries, fetch calls, console output, errors — back to
   the proxy.

The proxy collects everything, runs analysis (security scanning, N+1 detection,
performance insights), and serves a live dashboard at `/__brakit`.

```
┌────────────┐         ┌───────────────────┐         ┌───────────────────┐
│            │         │                   │         │                   │
│   Browser  │────────▶│   Brakit Proxy    │────────▶│    Dev Server     │
│            │◀────────│   (port 3000)     │◀────────│    (port 3001)    │
│            │         │                   │         │                   │
└────────────┘         │  + Dashboard      │         │  Hooks report     │
                       │  + Analysis       │◀────────│  queries, fetches │
                       │  + Security scan  │  HTTP   │  logs, errors     │
                       │                   │  POST   │                   │
                       └───────────────────┘         └───────────────────┘
```

That's the entire system. Two processes, one HTTP connection between them, and
a dashboard that shows everything.

---

## Why two processes?

The proxy and the dev server are separate processes on purpose. This gives us
two independent views of what's happening:

**From the outside (proxy):** Every HTTP request and response. Method, URL,
headers, body, status code, timing. This works with any backend — Node.js,
Python, Go, anything that speaks HTTP.

**From the inside (hooks):** Database queries, outgoing fetch calls, console
output, unhandled errors. This is the stuff you'd normally have to add
`console.log` statements to see. The hooks capture it automatically.

The two views are connected by a simple trick: the proxy adds a unique ID
(called `x-brakit-request-id`) to every request it forwards. The hooks inside
the dev server read that ID and tag their events with it. So when the dashboard
shows "this request fired 4 database queries," it knows which queries belong to
which request.

---

## How the proxy works

The proxy (`src/proxy/server.ts`) is a plain Node.js HTTP server with no
third-party proxy libraries. When a request arrives:

1. Generate a unique `requestId`.
2. Inject it as the `x-brakit-request-id` header.
3. Forward the request to the dev server (port + 1).
4. Stream the response back to the browser, unchanged.
5. Save a copy of the request and response (headers, body, timing) in memory.

If the URL starts with `/__brakit`, the proxy serves the dashboard instead of
forwarding. Everything else passes through transparently.

The proxy also hosts a **telemetry endpoint** (`/__brakit/api/ingest`) where
the dev server's hooks POST their captured events. This is how internal data
(queries, fetches, logs) gets from one process to the other.

---

## How the hooks work

When Brakit starts your dev server, it sets `NODE_OPTIONS="--import <preload>"`.
This is a Node.js feature that runs a script before any of your code loads. The
preload script (`src/instrument/preload.ts`) sets up four things:

### Request context tracking

Every incoming HTTP request gets wrapped in an `AsyncLocalStorage` context that
carries the `x-brakit-request-id` from the proxy. Any code that runs as part of
that request — even deep inside a database driver callback — can look up which
request it belongs to.

### Fetch hook

Uses Node.js `diagnostics_channel` to capture every outgoing `fetch()` call.
Records the URL, method, status code, and duration.

### Console hook

Wraps `console.log`, `console.warn`, `console.error`, etc. Records every
message along with which request triggered it.

### Error hook

Listens for uncaught exceptions and unhandled promise rejections. Records the
error name, message, and stack trace.

### Database adapters

This is where it gets interesting. Different projects use different database
libraries — pg, mysql2, Prisma, and so on. Brakit can't hardcode support for
all of them. Instead, it uses a **plugin system** where each library gets its
own adapter.

---

## The adapter system

Adding support for a new database library is the most common type of
contribution to Brakit. The system is designed so that it takes exactly **one
file** implementing **one interface**.

### How it works

Each adapter answers three questions:

1. **Is this library installed?** Check if the package exists in the user's
   `node_modules`. If not, skip it.
2. **How do I capture its queries?** Monkey-patch the library's internal methods
   to record what's happening and report it.
3. **How do I clean up?** Optionally restore the original methods.

In code, that's the `BrakitAdapter` interface:

```typescript
interface BrakitAdapter {
  name: string;          // "pg", "mysql2", "prisma", etc.
  detect(): boolean;     // Is the library installed?
  patch(emit): void;     // Start capturing queries
  unpatch?(): void;      // Stop capturing (optional)
}
```

### The adapter registry

On startup, brakit creates a registry of all known adapters. It calls
`detect()` on each one, and only `patch()`es the ones that are actually
installed. If one adapter fails (maybe the library changed its API between
versions), the others still work.

Currently, brakit ships with three adapters:

| Adapter | Library | What it patches |
|---------|---------|-----------------|
| pg | `pg` (PostgreSQL) | `Client.prototype.query` |
| mysql2 | `mysql2` | `Connection.prototype.query` and `.execute` |
| prisma | `@prisma/client` | Injects a Prisma client extension via `$extends` |

### Normalization

Every adapter translates its library's output into a common format. Regardless
of whether a query came from pg, mysql2, or Prisma, the analysis engine sees
the same fields:

- **operation** — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `OTHER`
- **table** — The table or model being queried
- **duration** — How long it took, in milliseconds

This is important because it means the analysis code (N+1 detection, security
scanning) never needs to know which database library you're using. It just sees
normalized queries.

---

## How events get from the dev server to the proxy

All captured events (queries, fetches, logs, errors) are sent over HTTP to the
proxy's ingest endpoint. The transport (`src/instrument/transport.ts`) batches
events and flushes them every 50ms or when 20 events accumulate — whichever
comes first.

The transport is "fire and forget" — it doesn't wait for a response or retry on
failure. If the proxy isn't running, events are silently dropped. This ensures
the instrumentation never slows down or breaks the user's application.

---

## The analysis engine

Once events are stored, the analysis engine (`src/analysis/engine.ts`) runs
pattern detection across all captured data. It subscribes to the in-memory
stores and recomputes whenever new data arrives (with a 300ms debounce to avoid
thrashing during burst traffic).

The engine produces two kinds of results:

### Security findings

A set of rules that scan live traffic for real security issues:

| Rule | Severity | What it detects |
|------|----------|-----------------|
| Exposed secret | Critical | Fields like `password` or `api_key` in responses with real values |
| Token in URL | Critical | Auth tokens in query parameters instead of headers |
| Stack trace leak | Critical | Node.js stack traces sent to the client |
| Error info leak | Critical | DB connection strings or SQL in error responses |
| Insecure cookie | Warning | Missing `HttpOnly` or `SameSite` flags |
| Sensitive logs | Warning | Passwords or tokens in console output |
| CORS + credentials | Warning | `credentials: true` with wildcard origin |

Each rule is one file implementing a `SecurityRule` interface. Adding a new
rule means writing one file — the scanner automatically picks it up.

### Performance insights

Pattern detection across requests and queries:

- **N+1 queries** — Same query shape repeated 5+ times within one request
- **Redundant queries** — Exact same SQL fired multiple times per request
- **Cross-endpoint queries** — Same query appearing on >50% of endpoints
- **Slow endpoints** — Average response time above 1 second
- **Query-heavy endpoints** — More than 5 queries per request on average
- **Duplicate API calls** — Same endpoint fetched multiple times per action
- **Error hotspots** — Endpoints with >20% error rate
- **Large responses** — Average response body above 50KB
- **SELECT * detection** — Queries selecting all columns
- **High row counts** — Queries returning 100+ rows

---

## Data storage

All captured data lives in bounded in-memory arrays. No external database
required. Each store holds up to 1,000 entries and evicts the oldest when full.

| Store | Contains |
|-------|----------|
| RequestStore | HTTP requests and responses captured by the proxy |
| QueryStore | Database queries from adapters |
| FetchStore | Outgoing fetch calls |
| LogStore | Console output |
| ErrorStore | Uncaught exceptions and unhandled rejections |
| MetricsStore | Per-endpoint statistics, persisted to `.brakit/metrics.json` |

Every store supports pub/sub — when a new entry is added, all subscribers are
notified. This is how the SSE stream (real-time dashboard updates) and the
analysis engine stay in sync without polling.

---

## Framework detection

Brakit reads your `package.json` and looks for known framework dependencies to
figure out how to start your dev server:

| Dependency | Framework | Dev command |
|-----------|-----------|-------------|
| `next` | Next.js | `next dev --port <port>` |
| `@remix-run/dev` | Remix | `remix dev` |
| `nuxt` | Nuxt | `nuxt dev --port <port>` |
| `vite` | Vite | `vite --port <port>` |
| `astro` | Astro | `astro dev --port <port>` |

If your framework isn't listed, or you're not using Node.js at all, you can
tell brakit exactly what to run:

```bash
brakit --command "python manage.py runserver"
brakit --command "go run main.go"
```

When you use `--command`, brakit skips framework detection and runs your command
directly. The proxy still captures all HTTP traffic. For Node.js commands, the
`--import` hooks are still injected automatically.

---

## Supporting other languages

Brakit isn't limited to Node.js. The proxy captures HTTP traffic from any
backend. For deeper instrumentation (database queries, logs), any language can
POST events to the ingest endpoint:

```
POST http://localhost:<BRAKIT_PORT>/__brakit/api/ingest
```

```json
{
  "_brakit": true,
  "version": 1,
  "sdk": "brakit-python/0.1.0",
  "events": [
    {
      "type": "db.query",
      "requestId": "from-x-brakit-request-id-header",
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

A language SDK just needs to: (1) read the `x-brakit-request-id` header from
incoming requests, (2) wrap database calls to capture timing, and (3) POST
events to the ingest endpoint. The proxy, stores, analysis engine, and
dashboard are completely reused.

---

## The dashboard

The dashboard is a server-rendered HTML page served at `/__brakit`. It uses no
frontend framework — the entire client is assembled from template-literal
JavaScript functions at build time. No build step, no external dependencies.

Real-time updates use Server-Sent Events (SSE). When the proxy captures a new
request or the dev server reports a new query, the dashboard updates instantly
without polling.

---

## Build output

Brakit builds three files:

| File | What it does |
|------|-------------|
| `dist/index.js` | Public API — for programmatic use or CI integration |
| `dist/bin/brakit.js` | The CLI you run with `npx brakit dev` |
| `dist/instrument/preload.js` | The hooks that run inside your dev server |

Database drivers (pg, mysql2, @prisma/client) are **not** bundled. The adapters
load them from your project's `node_modules` at runtime. This is essential —
the adapter needs to patch the exact same module instance your code imports.

---

## Extending brakit

The architecture is designed around three extension points:

1. **New database adapter** — One file implementing `BrakitAdapter`. See
   [CONTRIBUTING.md](../../CONTRIBUTING.md) for a step-by-step guide.

2. **New security rule** — One file implementing `SecurityRule`. The scanner
   picks it up automatically.

3. **New language SDK** — POST events to the ingest endpoint. No changes to
   brakit itself.

Each extension point is isolated. Adding a Drizzle adapter doesn't touch the
analysis engine. Adding a new security rule doesn't touch the adapters. Building
a Python SDK doesn't require any changes to the Node.js codebase.
