# Analysis Engine

Raw telemetry — requests, queries, logs, errors — is noise until something interprets it. The analysis engine turns that noise into two things developers actually act on: **performance insights** and **security findings**.

## Table of contents

- [Where the analysis engine fits in the system](#where-the-analysis-engine-fits-in-the-system)
- [How it works](#how-it-works)
- [The recompute cycle](#the-recompute-cycle)
- [PreparedInsightContext](#preparedinsightcontext)
- [Performance insights](#performance-insights)
- [Security findings](#security-findings)
- [Finding lifecycle](#finding-lifecycle)
- [Adding new rules](#adding-new-rules)
- [Anti-patterns](#anti-patterns)

---

## Where the analysis engine fits in the system

```
┌──────────────────────────────────────────────────────────────────┐
│  Your HTTP Server (Node.js process)                              │
│                                                                  │
│  Hooks & Adapters ──▶ EventBus ──▶ Stores                       │
│                          │                                       │
│                          │ telemetry:*                            │
│                          │ request:completed                     │
│                          ▼                                       │
│              ╔═══════════════════════╗                            │
│              ║   Analysis Engine     ║                            │
│              ║                       ║                            │
│              ║  ┌─────────────────┐  ║                            │
│              ║  │ Security Scanner│  ║  reads from                │
│              ║  │ (8 rules)       │◀═╬══ ServiceRegistry ──▶ Stores
│              ║  └─────────────────┘  ║                            │
│              ║  ┌─────────────────┐  ║                            │
│              ║  │ Insight Runner  │  ║                            │
│              ║  │ (13 rules)      │  ║                            │
│              ║  └─────────────────┘  ║                            │
│              ║           │           ║                            │
│              ╚═══════════╪═══════════╝                            │
│                          │                                       │
│                          ▼ analysis:updated                      │
│                       EventBus                                   │
│                          │                                       │
│              ┌───────────┼──────────────┐                        │
│              ▼           ▼              ▼                         │
│        ┌──────────┐ ┌─────────┐ ┌────────────┐                  │
│        │SSE → Browser│ Terminal│ │FindingStore│                  │
│        │ (live UI)│ │ display │ │ (persisted)│                  │
│        └──────────┘ └─────────┘ └────────────┘                  │
│                                       │                          │
│                                       ▼                          │
│                              .brakit/findings.json               │
└──────────────────────────────────────────────────────────────────┘
```

## How it works

The engine (`src/analysis/engine.ts`) subscribes to four bus channels and recomputes whenever new data arrives (with a 300ms debounce to avoid thrashing during burst traffic). If 50 queries fire within a request, the engine recomputes once after the burst settles, not 50 times.

---

## The recompute cycle

Each recompute:

1. Reads all stores via the ServiceRegistry (requests, queries, errors, logs, fetches)
2. Groups requests into flows (user actions spanning multiple requests)
3. Runs the **security scanner** — 8 rules checking live traffic for real vulnerabilities
4. Updates the **finding store** — upserting new findings, reconciling resolved ones
5. Runs the **insight runner** — 13 rules detecting performance patterns
6. Reconciles insight state — tracks which insights are open vs resolved
7. Emits `"analysis:updated"` on the bus with all results

The engine does not store raw telemetry. It reads from stores, computes results, and emits them. Stores are the source of truth; the engine is a pure transformation.

---

## PreparedInsightContext

Insight rules need to answer questions like "how many queries did this request fire?" and "what's the average response time for this endpoint?" Computing these per-rule would duplicate work.

`src/analysis/insights/prepare.ts` pre-computes shared indexes:

| Index | What it provides |
|-------|-----------------|
| `queriesByReq` | Map from requestId → queries fired during that request |
| `fetchesByReq` | Map from requestId → outgoing fetches during that request |
| `reqById` | Map from requestId → the request record |
| `endpointGroups` | Map from endpoint key → aggregated stats (total requests, error count, avg duration, query count, response size) |
| `nonStatic` | Requests filtered to exclude static assets and dashboard routes |

Every insight rule receives this `PreparedInsightContext`. Rules focus on detection logic, not data wrangling.

---

## Performance insights

13 rules in `src/analysis/insights/rules/`, each one file implementing the `InsightRule` interface:

| Rule | What it detects | Severity |
|------|----------------|----------|
| N+1 queries | Same query shape repeated 5+ times in one request | critical |
| Cross-endpoint queries | Same query appearing on >50% of endpoints | warning |
| Redundant queries | Exact same SQL fired multiple times per request | warning |
| Slow endpoints | High average response time with time breakdown | warning |
| Query-heavy endpoints | More than 5 queries per request on average | warning |
| Duplicate API calls | Same outgoing fetch fired multiple times per request | warning |
| Error hotspots | Endpoints with >20% error rate | warning |
| Large responses | Average response body above 50KB | info |
| SELECT * detection | Queries selecting all columns | info |
| High row counts | Queries returning 100+ rows | info |
| Response overfetch | Large JSON responses with many unused fields | info |
| Regression detection | P95 latency or query count increased vs previous session | warning |
| Security rollup | Surfaces security findings as an insight card | varies |

Rules return zero or more `Insight` objects. The runner sorts by severity (critical → warning → info) before emitting.

If a rule throws, it's skipped. Other rules still run.

---

## Security findings

8 rules in `src/analysis/rules/`, each one file implementing the `SecurityRule` interface:

| Rule | What it detects | Severity |
|------|----------------|----------|
| Exposed secret | Fields like `password` or `api_key` in responses with real values | critical |
| Token in URL | Auth tokens in query parameters instead of headers | critical |
| Stack trace leak | Node.js stack traces sent to the client | critical |
| Error info leak | DB connection strings or SQL in error responses | critical |
| Insecure cookie | Missing `HttpOnly` or `SameSite` flags | warning |
| Sensitive logs | Passwords or tokens in console output | warning |
| CORS + credentials | `credentials: true` with wildcard origin | warning |
| Response PII leak | Personal data (emails, phone numbers) in API responses | warning |

Security rules receive a `SecurityContext` containing requests and logs. Like insight rules, one rule throwing doesn't stop the scanner.

---

## Finding lifecycle

Security findings have state that persists across recomputes and app restarts:

```
open → fixing → resolved
```

- **open** — The issue exists in current traffic
- **fixing** — An AI assistant (via MCP) marked it as being worked on
- **resolved** — The issue disappeared from traffic after being marked as fixing

The FindingStore (`src/store/finding-store.ts`) generates stable IDs using SHA-256 hashes of the rule + endpoint + description. This means the same finding is recognized across app restarts, enabling persistence to `.brakit/findings.json`.

See [MCP documentation](mcp.md) for how AI assistants interact with findings.

---

## Adding new rules

**New insight rule:**
1. Create a file in `src/analysis/insights/rules/` implementing `InsightRule`
2. Register it in `src/analysis/insights/rules/index.ts`
3. The rule receives `PreparedInsightContext` with pre-computed indexes

**New security rule:**
1. Create a file in `src/analysis/rules/` implementing `SecurityRule`
2. Register it in `src/analysis/rules/scanner.ts` via `createDefaultScanner()`
3. The rule receives `SecurityContext` with requests and logs

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full step-by-step tutorials with code examples.

---

## Anti-patterns

**Don't run expensive computation in event handlers.** The engine debounces recomputes for a reason. If you subscribe to bus events directly to compute analytics, you'll run on every single event instead of batched.

**Don't access stores outside of recompute.** The engine reads all stores at the start of recompute to get a consistent snapshot. Reading stores at random times from rules would see inconsistent state.

**Don't catch errors inside rules to return partial results.** If your rule encounters unexpected data, prefer returning an empty array over returning a half-formed insight. The runner already catches and skips failing rules.

**Don't duplicate PreparedInsightContext work.** If you need a new index (e.g., errors grouped by endpoint), add it to `prepare.ts` so all rules benefit, rather than computing it in a single rule.
