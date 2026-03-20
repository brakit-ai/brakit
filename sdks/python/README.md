<h1 align="center"><img src="https://raw.githubusercontent.com/brakit-ai/brakit/main/docs/images/icon.png" height="24" alt="" />&nbsp;&nbsp;Brakit Python SDK</h1>

<p align="center">
  <b>AI writes your code. Brakit watches what it does.</b> <br />
  Every request, query, and API call mapped to the action that triggered it. See your entire backend at a glance. <br />
  <b>Open source · Local first · Zero config · AI-native via MCP</b>
</p>

<h3 align="center">
  <a href="https://github.com/brakit-ai/brakit">GitHub</a> &bull;
  <a href="https://brakit.ai">Website</a> &bull;
  <a href="https://github.com/brakit-ai/brakit/blob/main/CONTRIBUTING.md">Contributing</a>
</h3>

<h4 align="center">
  <a href="https://github.com/brakit-ai/brakit/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
  <a href="https://pypi.org/project/brakit/">
    <img src="https://img.shields.io/pypi/v/brakit" alt="PyPI version" />
  </a>
  <a href="https://pypi.org/project/brakit/">
    <img src="https://img.shields.io/pypi/pyversions/brakit" alt="Python versions" />
  </a>
  <a href="https://www.npmjs.com/package/brakit">
    <img src="https://img.shields.io/npm/v/brakit" alt="npm version" />
  </a>
  <a href="https://github.com/brakit-ai/brakit/blob/main/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs welcome!" />
  </a>
</h4>

---

<p align="center">
  <img width="700" src="https://raw.githubusercontent.com/brakit-ai/brakit/main/docs/images/actions.png" alt="Brakit Actions — endpoints grouped by user action" />
  <br />
  <sub>Every endpoint grouped by the action that triggered it — see "Sign Up" and "Load Dashboard", not 47 raw requests</sub>
</p>

<p align="center">
  <img width="700" src="https://raw.githubusercontent.com/brakit-ai/brakit/main/docs/images/dashboard.png" alt="Brakit Dashboard — issues surfaced automatically" />
  <br />
  <sub>Brakit catches N+1 queries, PII leaks, and slow endpoints as you develop</sub>
</p>

<p align="center">
  <img width="700" src="https://raw.githubusercontent.com/brakit-ai/brakit/main/docs/images/vscode.png" alt="Claude reading Brakit findings in VS Code" />
  <br />
  <sub>Claude reads issues via MCP and fixes your code</sub>
</p>

## Quick Start

The Python SDK captures queries, fetches, and requests from your **FastAPI** or **Flask** backend and forwards them to the Brakit dashboard running in your Node.js frontend.

### 1. Install the Node.js core (runs the dashboard)

```bash
npx brakit install
```

### 2. Install the Python SDK

```bash
pip install brakit
```

### 3. Add one import to your app

**FastAPI:**
```python
import brakit  # must be before FastAPI import
from fastapi import FastAPI

app = FastAPI()
```

**Flask:**
```python
import brakit  # must be before Flask import
from flask import Flask

app = Flask(__name__)
```

That's it. Start both apps normally. The Python SDK auto-detects your framework, instruments queries and fetches, and forwards everything to the Brakit dashboard at `http://localhost:<port>/__brakit`.

> **Full setup guide:** [brakit.ai/docs/introduction](https://brakit.ai/docs/introduction)

---

## What You Get

- **Cross-service tracing** — FETCH from Next.js to FastAPI? The DB query inside FastAPI nests under the fetch automatically
- **Full server tracing** — DB queries, outgoing HTTP calls, errors — zero code changes
- **Live dashboard** at `/__brakit` — performance overview, request timeline, scatter charts
- **8 security rules** scanned against live traffic — leaked secrets, PII in responses, missing auth flags
- **N+1 query detection** — same query pattern repeated 5+ times in a single request
- **AI-native via MCP** — Claude Code and Cursor can query issues and verify fixes directly

---

## Supported Frameworks

| Framework | Status    |
| --------- | --------- |
| FastAPI   | Supported |
| Flask     | Supported |
| Django    | Planned   |

## Supported Databases

| Driver     | Status    |
| ---------- | --------- |
| SQLAlchemy | Supported |
| asyncpg    | Supported |
| psycopg    | Planned   |

## Supported HTTP Clients

| Library  | Status    |
| -------- | --------- |
| urllib3  | Supported |
| httpx    | Supported |
| aiohttp  | Supported |
| requests | Supported (via urllib3) |

---

## How It Works

```
import brakit  →  auto-detect framework  →  instrument everything
                        |
                        +-- DB queries    (SQLAlchemy, asyncpg)
                        +-- HTTP fetches  (httpx, aiohttp, urllib3)
                        +-- Errors        (global exception hooks)
                        +-- Logs          (logging module)
                              |
                              +-- Forward to Node.js dashboard via localhost
```

`import brakit` patches your framework's middleware to capture request/response pairs, hooks into database drivers and HTTP clients, and forwards telemetry to the Brakit dashboard running in your Node.js process. No proxy, no extra ports.

### Production Safety

Brakit never runs in production. Multiple layers ensure it:

| Layer                        | How it blocks                             |
| ---------------------------- | ----------------------------------------- |
| `should_activate()`          | Checks `NODE_ENV` + 15 cloud/CI env vars  |
| devDependency                | Not installed in production                |
| `safe_wrap` + circuit breaker | Errors in brakit code fall back silently  |
| `BRAKIT_DISABLE=true`        | Manual kill switch                        |

---

## Optional Dependencies

```bash
# FastAPI support
pip install brakit[fastapi]

# Flask support
pip install brakit[flask]

# Development (tests, linting)
pip install brakit[dev]
```

---

## Development

```bash
git clone https://github.com/brakit-ai/brakit.git
cd brakit/sdks/python

pip install -e ".[dev]"
pytest tests/ -v
```

---

## Contributing

Brakit is early and moving fast. Areas where help would be great:

- **Database adapters** — psycopg, Tortoise ORM, Django ORM
- **Framework adapters** — Django, Starlette
- **HTTP client hooks** — more client libraries
- **Security rules** — new patterns, configurable severity

Please open an issue first for larger changes so we can discuss the approach.

## License

[MIT](https://github.com/brakit-ai/brakit/blob/main/LICENSE)
