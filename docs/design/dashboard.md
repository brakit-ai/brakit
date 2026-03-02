# Dashboard

Brakit serves a live dashboard at `/__brakit` that shows requests, queries, errors, performance insights, and security findings in real time. This document covers how it's built.

## Table of contents

- [Architecture overview](#architecture-overview)
- [Routing](#routing)
- [The REST API](#the-rest-api)
- [Server-Sent Events](#server-sent-events)
- [Client architecture](#client-architecture)
- [Security](#security)
- [Extending the dashboard](#extending-the-dashboard)

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Your HTTP Server (Node.js process)                              │
│                                                                  │
│  Incoming request ──▶ Interceptor                                │
│                          │                                       │
│              ┌───────────┴───────────┐                           │
│              ▼                       ▼                           │
│     URL starts with          Your app's route                    │
│     /__brakit?               handlers run normally               │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Dashboard (localhost only)                             │     │
│  │                                                         │     │
│  │  Router ──▶ /__brakit          → HTML page (inlined JS) │     │
│  │         ──▶ /__brakit/api/*    → REST handlers          │     │
│  │         ──▶ /__brakit/api/events → SSE stream           │     │
│  │                                                         │     │
│  │  REST handlers ──▶ ServiceRegistry ──▶ Stores (read)    │     │
│  │  SSE handler   ──▶ EventBus ──▶ Subscribe to channels   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ EventBus │  │  Stores  │  │  Analysis  │  │ MCP Server   │  │
│  │ (channels│  │ (7 total)│  │  Engine    │  │ (separate    │  │
│  │  + subs) │  │          │  │            │  │  process,    │  │
│  └──────────┘  └──────────┘  └────────────┘  │  same API)   │  │
│                                               └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         │ SSE stream                      │ REST API
         ▼                                 ▼
   ┌──────────┐                      ┌───────────┐
   │ Browser  │                      │ AI Agent  │
   │/__brakit │                      │(Claude,   │
   └──────────┘                      │ Cursor)   │
                                     └───────────┘
```

The dashboard is a single self-contained HTML page. All JavaScript and CSS are inlined at build time — no external requests, no CDN, no asset loading. Open `/__brakit` in a browser and everything works immediately.

Real-time updates use Server-Sent Events. When brakit captures a new request or a database adapter reports a query, the dashboard updates instantly without polling.

---

## Routing

`src/dashboard/router.ts` creates a route table mapping URL paths to handler functions:

| Path | Handler | Purpose |
|------|---------|---------|
| `/__brakit` | HTML page | Serves the dashboard |
| `/__brakit/api/requests` | `createRequestsHandler` | List captured requests |
| `/__brakit/api/flows` | `createFlowsHandler` | List request flows (user actions) |
| `/__brakit/api/events` | `createSSEHandler` | SSE stream for real-time updates |
| `/__brakit/api/logs` | `createLogsHandler` | List captured console logs |
| `/__brakit/api/fetches` | `createFetchesHandler` | List outgoing fetch calls |
| `/__brakit/api/errors` | `createErrorsHandler` | List captured errors |
| `/__brakit/api/queries` | `createQueriesHandler` | List database queries |
| `/__brakit/api/metrics` | `createMetricsHandler` | Per-endpoint session metrics |
| `/__brakit/api/metrics/live` | `createLiveMetricsHandler` | Current session live metrics |
| `/__brakit/api/activity` | `createActivityHandler` | Timeline of events for a request |
| `/__brakit/api/insights` | `createInsightsHandler` | Performance insights |
| `/__brakit/api/security` | `createSecurityHandler` | Security findings |
| `/__brakit/api/findings` | `createFindingsHandler` | Stateful findings with lifecycle |
| `/__brakit/api/ingest` | `createIngestHandler` | External SDK event ingestion |
| `/__brakit/api/clear` | `createClearHandler` | Clear all stores |

Every handler is a factory function that receives the `ServiceRegistry`. No global imports, no singletons.

The router also checks `isDashboardRequest(url)` — if a request URL starts with `/__brakit`, it's handled by the dashboard instead of your app.

---

## The REST API

All API endpoints follow the same pattern:

- GET-only (except `/api/ingest` which accepts POST and `/api/clear` which accepts POST)
- Return JSON with `sendJson()` helper
- Access stores through the ServiceRegistry
- Support query parameters for filtering (e.g., `?requestId=...`)

Response shapes are defined in `src/types/api-contracts.ts` and shared between the server, the MCP client, and the dashboard client.

---

## Server-Sent Events

`src/dashboard/sse.ts` provides the real-time update stream. When a browser connects to `/__brakit/api/events`:

1. Open a persistent HTTP connection with `Content-Type: text/event-stream`
2. Subscribe to 6 bus channels via a `SubscriptionBag`
3. Forward each event as an SSE message
4. Send heartbeat comments every 30 seconds to keep the connection alive
5. On disconnect, call `subs.dispose()` to clean up all subscriptions

| Bus channel | SSE event type | What it carries |
|-------------|---------------|-----------------|
| `request:completed` | (default) | Completed request record |
| `telemetry:fetch` | `fetch` | Outgoing fetch call |
| `telemetry:log` | `log` | Console log entry |
| `telemetry:error` | `error_event` | Uncaught error |
| `telemetry:query` | `query` | Database query |
| `analysis:updated` | `insights` + `security` | Computed insights and findings |

The `analysis:updated` channel emits two SSE events — one for insights, one for security findings — so the client can update each section independently.

---

## Client architecture

The dashboard client lives in `src/dashboard/client/`. It's built as template-literal JavaScript — TypeScript files that export strings of browser-ready ES5 code. These are assembled into a single `<script>` tag at build time.

The client maintains a `state` object that tracks:

- Requests, queries, logs, errors, fetches (arrays)
- Flows (grouped request sequences)
- Insights and findings (from analysis engine)
- Currently active tab
- Expand/collapse state for detail views

Tab navigation updates the view by re-rendering the active tab's content. SSE events update the state object and trigger a re-render of affected sections.

---

## Security

The dashboard enforces several security measures:

**Localhost-only access.** The interceptor only serves dashboard routes to localhost connections. Non-local IPs get a 404.

**Content Security Policy.** Every response includes a strict CSP header:
```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:
```

**Security headers.** All responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`.

**XSS prevention.** User-controllable content (request URLs, query text, error messages) is escaped via `escHtml()` before insertion into the DOM.

---

## Extending the dashboard

**Adding a new API endpoint:**

1. Create a handler factory in `src/dashboard/api/` — e.g., `createMyHandler(registry: ServiceRegistry)`
2. Add a route constant in `src/constants/routes.ts`
3. Register the route in `src/dashboard/router.ts`

**Adding a new SSE event type:**

1. Add a bus channel to `ChannelMap` in `src/core/event-bus.ts` (see [EventBus docs](event-bus.md))
2. Subscribe in `src/dashboard/sse.ts` and forward as an SSE event
3. Handle in the client's EventSource listener

**Adding a new dashboard tab:**

1. Create a view file in `src/dashboard/client/views/`
2. Add the tab to the sidebar navigation in `src/dashboard/client/app.ts`
3. Add the render function to the tab dispatch
