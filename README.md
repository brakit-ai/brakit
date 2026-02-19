# Brakit — See What Your App Is Really Doing

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178c6.svg)](https://typescriptlang.org)

Brakit is a runtime devtool that sits between your browser and your dev server. It captures every HTTP request, groups them by user action, detects duplicates and N+1 queries, runs security checks, and gives you a live dashboard — all without touching your code.

[Quick Start](#quick-start) · [What You Get](#what-you-get) · [Features](#features) · [How It Works](#how-it-works) · [CLI Options](#cli-options) · [Contributing](#contributing)

---

## Quick Start

```bash
npx brakit dev
```

That's it. Brakit auto-detects your framework, starts your dev server behind a transparent proxy, and serves a dashboard at `http://localhost:3000/__brakit`.

```bash
npx brakit dev --port 8080    # Custom proxy port
npx brakit dev --show-static  # Include static assets in output
npx brakit dev ./my-app       # Specify project directory
```

> **Requirements:** Node.js >= 18 and a project with `package.json`.

---

## What You Get

- **Action-level visibility** — see "Sign Up" and "Load Dashboard", not raw HTTP requests
- **Duplicate & N+1 detection** — automatically flags redundant API calls and repeated query patterns
- **Live dashboard** at `/__brakit` — 9 tabs updating in real-time via SSE
- **Full server tracing** — fetch calls, DB queries, console logs, errors — zero code changes
- **7 security rules** scanned against actual traffic, not static analysis
- **Performance tracking** — health grades and p95 trends across dev sessions

---

## Features

### Actions, Not HTTP Noise

Brakit groups raw requests into human-readable actions. You see what happened, not which endpoints were hit:

```
History Page                         1.6s   40% redundant

   Loaded user data ............. 657ms  OK
   Loaded user data ............. 185ms  duplicate
   Loaded video list ........... 1117ms  OK
   Loaded video list ............ 273ms  duplicate
   Loaded page .................. 128ms  OK

   2 requests duplicated — same data loaded twice
```

### Live Dashboard

Open `/__brakit` in your browser. 9 tabs — actions, requests, server fetches, database queries, errors, logs, security, and performance — all updating in real-time via SSE.

### Zero-Config Instrumentation

Brakit hooks into your Node.js process via `--import` — no code changes, no SDK, no config file:

- **`fetch()` calls** — every outbound request your server makes
- **Database queries** — pg, mysql2, Prisma with SQL, timing, and row counts
- **Console output** — `log`, `warn`, `error` linked to the originating request
- **Unhandled errors** — exceptions with full stack traces

### Smart Analysis

Brakit doesn't just capture — it understands what it sees:

- **Duplicate detection** — Same endpoint called twice in one action? Flagged with redundancy %.
- **N+1 queries** — Same query pattern repeated 5+ times in a single request? That's an N+1.
- **Polling collapse** — 22 calls to `/api/status`? Collapsed into one "Polling status (22x, 40.1s)" entry.
- **Smart grouping** — Requests grouped by origin page via `referer`. Navigate to a new page, new action group.

### Security Scanner

7 high-confidence rules that scan your live traffic and flag real issues — not theoretical ones:

| | Rule | What it catches |
|---|------|-----------------|
| **Critical** | Exposed Secret | Response contains `password`, `api_key`, `client_secret` fields with real values |
| **Critical** | Token in URL | Auth tokens in query parameters instead of headers |
| **Critical** | Stack Trace Leak | Internal stack traces sent to the client |
| **Critical** | Error Info Leak | DB connection strings, SQL queries, or secret values in error responses |
| Warning | Insecure Cookie | Missing `HttpOnly` or `SameSite` flags |
| Warning | Sensitive Logs | Passwords, secrets, or token values in console output |
| Warning | CORS + Credentials | `credentials: true` with wildcard origin |

### Performance Tracking

Metrics persist across dev sessions in `.brakit/metrics.json`:

- **Health grades** — Fast / Good / OK / Slow / Critical per endpoint
- **p95 response times** with trend arrows
- **Session comparison** — see if that refactor actually helped

---

## How It Works

```
Browser  -->  Brakit (:3000)  -->  Your dev server (:3001)
                  |
                  +-- Dashboard UI    (/__brakit)
                  +-- Live SSE stream (real-time updates)
                  +-- Telemetry       (from instrumented process)
```

Brakit is a transparent HTTP reverse proxy. Every request passes through unchanged — your app works exactly the same. Brakit captures request/response pairs, groups them into flows, and streams everything to the dashboard.

The instrumentation layer runs inside your dev server process (injected via `--import`) and sends telemetry back to Brakit over a local HTTP connection. That's how fetch calls, queries, and console output get captured without any code changes.

### Supported Frameworks

| Framework | Detection | Status |
|-----------|-----------|--------|
| **Next.js** | Auto-detected via `next` in `package.json` | Supported |
| Any HTTP server | Specify port manually | Works via proxy |

More frameworks coming — Express, Fastify, Remix, SvelteKit, Nuxt. PRs welcome.

---

## CLI Options

```bash
npx brakit dev                # Auto-detect and start
npx brakit dev --port 3000    # Custom proxy port (default: 3000)
npx brakit dev --show-static  # Show static asset requests
npx brakit dev ./my-app       # Specify project directory
```

---

## Development

```bash
git clone https://github.com/user/brakit.git
cd brakit

npm install
npm run build       # Build with tsup
npm run dev         # Watch mode
npm run typecheck   # Type-check without emitting
npm test            # Run tests with vitest
```

Only 2 production dependencies: `citty` (CLI) and `picocolors` (terminal colors). Everything else is Node.js built-ins.

### Architecture

```
src/
  analysis/       Categorization, labeling, flow grouping, duplicate/N+1 detection
  cli/            CLI entry point (citty)
  dashboard/
    api/          REST handlers — requests, flows, telemetry, metrics, ingest
    client/       Browser JS generated as template strings
      rules/      Security rules split by severity
      views/      Tab renderers (overview, flows, graph, etc.)
    styles/       CSS modules
  detect/         Framework auto-detection
  instrument/     Runtime hooks (fetch, console, db, errors) + batched transport
  proxy/          HTTP reverse proxy, request capture, WebSocket forwarding
  store/          In-memory telemetry stores + persistent metrics
  types/          TypeScript definitions by domain
```

---

## Contributing

Contributions welcome. Some areas where help would be great:

- **Framework support** — Express, Fastify, Remix, SvelteKit, Nuxt
- **Database drivers** — SQLite, MongoDB, Drizzle ORM
- **Dashboard** — Request diff, timeline view, HAR export
- **Security rules** — More patterns, configurable severity

Please open an issue first for larger changes so we can discuss the approach.

## License

[MIT](LICENSE)
