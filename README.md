# Brakit

**Your API is leaking data. Your queries are slow. Brakit shows you.**

AI writes your API. Nobody checks what it does — missing auth, leaked data, N+1 queries, slow endpoints. Brakit watches your app run and shows you everything. One command. Zero setup.

Open source · Local only · Zero config · 2 dependencies

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178c6.svg)](https://typescriptlang.org)

<!-- TODO: Add demo gif showing: npx brakit dev → use app → dashboard shows issues -->
<!-- ![Brakit Demo](assets/demo.gif) -->

---

## Quick Start

```bash
npx brakit dev
```

That's it. Brakit auto-detects your framework, starts your dev server behind a transparent proxy, and serves a live dashboard at `/__brakit`.

```bash
npx brakit dev --port 8080    # Custom proxy port
npx brakit dev --show-static  # Include static assets in output
npx brakit dev ./my-app       # Specify project directory
```

> **Requirements:** Node.js >= 18 and a project with `package.json`.

[Documentation](https://brakit.ai/docs) · [Website](https://brakit.ai)

---

## What You Get

- **8 security rules** scanned against live traffic — leaked secrets, PII in responses, missing auth, N+1 queries flagged automatically
- **Action-level visibility** — see "Sign Up" and "Load Dashboard", not 47 raw HTTP requests
- **Duplicate detection** — same API called twice? Flagged with redundancy percentage
- **N+1 query detection** — same query pattern repeated 5+ times in a single request? That's an N+1
- **Full server tracing** — fetch calls, DB queries, console logs, errors — zero code changes
- **Live dashboard** at `/__brakit` — 9 tabs updating in real-time
- **Performance tracking** — health grades and p95 trends across dev sessions

---

## You Don't Know What Your API Is Doing

You ship a signup flow. It works. But behind the scenes — 3 duplicate fetches, an N+1 query hitting the DB 12 times, and your user's email sitting in the response body unmasked. You'd never know without digging through network tabs and server logs for an hour.

Brakit watches every action your app takes — not raw HTTP noise, but what actually happened: "Sign Up" took 847ms, fired 4 queries (one is an N+1), called Clerk twice (one failed), and leaked a secret in the response. One glance. No `console.log`. No guessing.

---

## Security Scanner

8 high-confidence rules that scan your live traffic and flag real issues — not theoretical ones:

|              | Rule             | What it catches                                                                 |
| ------------ | ---------------- | ------------------------------------------------------------------------------- |
| **Critical** | Exposed Secret   | Response contains `password`, `api_key`, `client_secret` fields with real values |
| **Critical** | Token in URL     | Auth tokens in query parameters instead of headers                              |
| **Critical** | Stack Trace Leak | Internal stack traces sent to the client                                        |
| **Critical** | Error Info Leak  | DB connection strings, SQL queries, or secret values in error responses          |
| Warning      | PII in Response  | API echoes back emails, returns full user records with internal IDs              |
| Warning      | Insecure Cookie  | Missing `HttpOnly` or `SameSite` flags                                          |
| Warning      | Sensitive Logs   | Passwords, secrets, or token values in console output                           |
| Warning      | CORS + Credentials | `credentials: true` with wildcard origin                                      |

---

## Who Is This For

Developers using AI tools (Cursor, Copilot, Claude Code) to generate API code they don't fully review. Developers who debug with `console.log` and wish they could just see every action their API is executing. Anyone building Node.js APIs who wants to catch security and performance issues before production.

---

## Principles — ZEAL

Everything we build is anchored around four pillars:

| | Pillar | What it means |
|---|---|---|
| **Z** | **Zero Config** | One command to start, zero config by default. Optional middleware for deeper integration — but the default path is always zero-touch. |
| **E** | **Extensible** | Open source. One file, one interface. Add a database adapter, security rule, or language SDK without touching brakit's core. |
| **A** | **AI-Native** | Built for the era where AI writes code humans don't fully review. A safety net for AI-generated APIs. |
| **L** | **Language Agnostic** | HTTP proxy works with any backend. SDK protocol accepts events from any language. Not locked to Node.js. |

---

## How It Works

```
Browser  -->  Brakit (proxy)  -->  Your dev server
                  |
                  +-- Dashboard UI    (/__brakit)
                  +-- Live SSE stream (real-time updates)
                  +-- Telemetry       (from instrumented process)
```

Brakit is a transparent HTTP reverse proxy. Every request passes through unchanged — your app works exactly the same. Brakit captures request/response pairs, groups them into actions, and streams everything to the dashboard.

The instrumentation layer runs inside your dev server process (injected via `--import`) and sends telemetry back to Brakit over a local HTTP connection. That's how fetch calls, queries, and console output get captured without any code changes.

### Supported Frameworks

| Framework   | Status                     |
| ----------- | -------------------------- |
| Next.js     | Full support (auto-detect) |
| Remix       | Auto-detect                |
| Nuxt        | Auto-detect                |
| Vite        | Auto-detect                |
| Astro       | Auto-detect                |
| Any backend | Via `--command` flag        |

### Supported Databases

| Driver  | Status    |
| ------- | --------- |
| pg      | Supported |
| mysql2  | Supported |
| Prisma  | Supported |
| SQLite  | Planned   |
| MongoDB | Planned   |
| Drizzle | Planned   |

---

## CLI Options

```bash
npx brakit dev                              # Auto-detect and start
npx brakit dev --port 3000                  # Custom proxy port (default: 3000)
npx brakit dev --show-static                # Show static asset requests
npx brakit dev ./my-app                     # Specify project directory
npx brakit dev --command "python manage.py" # Any backend, any language
```

---

## Development

```bash
git clone https://github.com/brakit-ai/brakit.git
cd brakit

npm install
npm run build       # Build with tsup
npm run dev         # Watch mode
npm run typecheck   # Type-check without emitting
npm test            # Run tests with vitest
```

Only 2 production dependencies: `citty` (CLI) and `picocolors` (terminal colors). Everything else is Node.js built-ins.

### Architecture

For a full walkthrough of how brakit works — the two-process model, adapter
system, analysis engine, and SDK protocol — see
[How Brakit Works](docs/design/architecture.md).

```
src/
  analysis/       Security scanning, N+1 detection, insights engine
    rules/        SecurityRule implementations (one file per rule)
  cli/            CLI entry point (citty)
  dashboard/
    api/          REST handlers — requests, flows, telemetry, metrics, ingest
    client/       Browser JS generated as template strings
      views/      Tab renderers (overview, flows, graph, etc.)
    styles/       CSS modules
  detect/         Framework auto-detection
  instrument/     Node.js --import instrumentation
    adapters/     BrakitAdapter implementations (one file per library)
    hooks/        Core runtime hooks (fetch, console, errors, context)
  proxy/          HTTP reverse proxy, request capture, WebSocket forwarding
  store/          In-memory telemetry stores + persistent metrics
  types/          TypeScript definitions by domain
```

---

## Contributing

Brakit is early and moving fast. The most common contributions — adding a new
database adapter or a new security rule — each require exactly one file and one
interface. See [CONTRIBUTING.md](CONTRIBUTING.md) for step-by-step guides.

Some areas where help would be great:

- **Database adapters** — Drizzle, Mongoose, SQLite, MongoDB
- **Security rules** — More patterns, configurable severity
- **Language SDKs** — Python, Go, Ruby (uses the [ingest protocol](docs/design/architecture.md#supporting-other-languages))
- **Dashboard** — Request diff, timeline view, HAR export

Please open an issue first for larger changes so we can discuss the approach.

## License

[MIT](LICENSE)
