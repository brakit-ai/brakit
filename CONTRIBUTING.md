# Contributing to Brakit

Brakit is designed so that the most common contributions — adding support for a
new database library, adding a security rule, or adding an insight rule —
require exactly one file and one interface. This guide covers the four main
contribution paths.

## Table of contents

- [Setup](#setup)
- [Project structure](#project-structure)
- [Adding a database adapter](#adding-a-database-adapter)
- [Adding a security rule](#adding-a-security-rule)
- [Adding an insight rule](#adding-an-insight-rule)
- [Building a language SDK](#building-a-language-sdk)
- [How to contribute](#how-to-contribute)
- [Code style](#code-style)
- [Commit messages](#commit-messages)
- [License](#license)

---

## Setup

```bash
git clone https://github.com/brakit-ai/brakit.git
cd brakit
npm install
npm run build
npm test
```

The build produces three entry points in `dist/`:

| Entry | Purpose |
|-------|---------|
| `dist/api.js` | Public library API |
| `dist/bin/brakit.js` | CLI binary |
| `dist/runtime/index.js` | In-process runtime (`import 'brakit'`) |

During development, `npm run dev` runs tsup in watch mode. Tests use vitest
(`npm test` or `npm run test:watch`).

## Project structure

```
src/
  analysis/            # Insights engine and security scanner
    insights/          # InsightRule implementations (one file per rule)
    rules/             # SecurityRule implementations (one file per rule)
  cli/                 # CLI command definitions (citty)
  constants/           # Shared thresholds, route paths, limits
  dashboard/           # HTML dashboard, REST API handlers, SSE
    api/               # API route handlers
    client/            # Client-side template-literal JavaScript
  detect/              # Framework auto-detection
  instrument/          # Instrumentation adapters and hooks
    adapters/          # BrakitAdapter implementations (one file per library)
    hooks/             # Core runtime hooks (fetch, console, errors, context)
  output/              # Terminal insight listener
  runtime/             # In-process architecture (interceptor, capture, health)
  store/               # In-memory bounded stores with pub/sub
  telemetry/           # Anonymous usage analytics
  types/               # TypeScript type definitions
  utils/               # Shared utilities (collections, format, math, endpoint)
tests/
docs/
  design/              # Architecture design documents
```

---

## Adding a database adapter

This is the most common contribution. Each adapter is one file in
`src/instrument/adapters/` implementing the `BrakitAdapter` interface.

### The interface

```typescript
// src/instrument/adapter.ts
interface BrakitAdapter {
  name: string;          // unique identifier, e.g. "drizzle"
  detect(): boolean;     // is the library installed?
  patch(emit): void;     // monkey-patch and call emit() on each operation
  unpatch?(): void;      // optional: restore originals
}
```

### Step-by-step

**1. Create `src/instrument/adapters/<library>.ts`:**

```typescript
import type { BrakitAdapter } from "../adapter.js";
import type { TelemetryEvent } from "../../types/index.js";
import { tryRequire, captureRequestId } from "./shared.js";
import { normalizeSQL } from "./normalize.js";

export const drizzleAdapter: BrakitAdapter = {
  name: "drizzle",

  detect() {
    return tryRequire("drizzle-orm") !== null;
  },

  patch(emit) {
    const drizzle = tryRequire("drizzle-orm");
    if (!drizzle) return;

    // Find the prototype method to patch.
    // Each library is different — read the library's source to find
    // the right interception point.

    const origMethod = /* ... */;

    /* replace with wrapper */ = function (...args) {
      const start = performance.now();
      const requestId = captureRequestId(); // MUST be called before async ops

      const result = origMethod.apply(this, args);

      // Handle the result (callback, promise, or sync) and emit:
      emit({
        type: "query",
        data: {
          driver: "drizzle",
          source: "drizzle",
          sql: /* raw SQL if available */,
          normalizedOp: /* use normalizeSQL() or set directly */,
          table: /* table name */,
          durationMs: Math.round(performance.now() - start),
          rowCount: /* if available */,
          parentRequestId: requestId,
          timestamp: Date.now(),
        },
      });

      return result;
    };
  },

  unpatch() {
    // Restore the original method if you saved a reference
  },
};
```

**2. Register it in `src/instrument/adapters/index.ts`:**

```typescript
import { drizzleAdapter } from "./drizzle.js";

export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(pgAdapter);
  registry.register(mysql2Adapter);
  registry.register(prismaAdapter);
  registry.register(drizzleAdapter);  // add here
  return registry;
}
```

**3. Mark as external in `tsup.config.ts`:**

```typescript
external: ["pg", "mysql2", "@prisma/client", "drizzle-orm"],
```

This ensures tsup doesn't bundle the library — the adapter resolves it from
the user's `node_modules` at runtime.

**4. Test it:**

```bash
npm run build
npm test
```

Then create a test project with the library installed and run `npx brakit` to
verify queries appear in the dashboard.

### Key rules

- **Call `captureRequestId()` before any async operation.** Database drivers use
  connection pools and native bindings that break `AsyncLocalStorage`. Capture
  the request ID eagerly.
- **Use `tryRequire()` from `shared.ts`.** It resolves from the user's project
  directory, not brakit's. Never `import` the library directly.
- **Always emit normalized fields.** `normalizedOp`, `table`, and `source` must
  be present so the analysis engine works without library-specific logic.
- **Wrap in try/catch.** If patching fails (API changed between library
  versions), the adapter should fail silently. Other adapters must still load.
- **Handle all return patterns.** Library methods may return callbacks, promises,
  or EventEmitters depending on how they're called. See `pgAdapter` for a
  comprehensive example.

---

## Adding a security rule

Each security rule is one file in `src/analysis/rules/` implementing the
`SecurityRule` interface.

### The interface

```typescript
// src/analysis/rules/rule.ts
interface SecurityRule {
  id: string;                          // unique, kebab-case
  severity: "critical" | "warning";
  name: string;                        // human-readable title
  hint: string;                        // actionable fix suggestion
  check(ctx: SecurityContext): SecurityFinding[];
}

interface SecurityContext {
  requests: readonly TracedRequest[];   // all captured HTTP requests
  logs: readonly TracedLog[];           // all captured console output
}
```

### Step-by-step

**1. Create `src/analysis/rules/<rule-name>.ts`:**

```typescript
import type { SecurityRule } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";

export const myRule: SecurityRule = {
  id: "my-rule-id",
  severity: "warning",
  name: "Human Readable Name",
  hint: "Actionable suggestion for how to fix this.",

  check(ctx) {
    const findings: SecurityFinding[] = [];

    for (const r of ctx.requests) {
      // Your detection logic here.
      // Deduplicate by endpoint to avoid flooding the user.
      if (/* condition */) {
        findings.push({
          severity: "warning",
          rule: this.id,
          title: this.name,
          desc: `${r.method} ${r.path} — description of what was found`,
          hint: this.hint,
          endpoint: `${r.method} ${r.path}`,
          count: 1,
        });
      }
    }

    return findings;
  },
};
```

**2. Register it in `src/analysis/rules/scanner.ts`:**

```typescript
import { myRule } from "./my-rule.js";

export function createDefaultScanner(): SecurityScanner {
  const scanner = new SecurityScanner();
  // ... existing rules ...
  scanner.register(myRule);
  return scanner;
}
```

**3. Export from `src/analysis/rules/index.ts`:**

```typescript
export { myRule } from "./my-rule.js";
```

### Key rules

- **Deduplicate findings.** Use a `Map` or `Set` keyed by endpoint to avoid
  returning 100 findings for the same issue on the same endpoint.
- **Keep `check()` fast.** It runs on every recomputation (debounced, but still
  on each batch of new data). Avoid O(n^2) patterns.
- **Use existing patterns from `patterns.ts`.** Regex constants for secret
  detection, stack traces, SQL fragments, etc. are already defined. Reuse them.
- **Test against real responses.** Security rules operate on `TracedRequest`
  which includes `responseBody`, `responseHeaders`, `statusCode`. Make sure
  your rule handles null/undefined bodies gracefully.

---

## Adding an insight rule

Each insight rule is one file in `src/analysis/insights/rules/` implementing
the `InsightRule` interface. Insight rules detect performance issues like N+1
queries, slow endpoints, regressions, and overfetching.

### The interface

```typescript
// src/analysis/insights/rule.ts
interface InsightRule {
  id: InsightType;
  check(ctx: PreparedInsightContext): Insight[];
}
```

The `PreparedInsightContext` provides pre-computed indexes shared across all
rules so you don't need to build your own:

```typescript
interface PreparedInsightContext extends InsightContext {
  nonStatic: readonly TracedRequest[];                     // requests excluding static assets
  queriesByReq: ReadonlyMap<string, TracedQuery[]>;        // queries grouped by request ID
  fetchesByReq: ReadonlyMap<string, TracedFetch[]>;        // fetches grouped by request ID
  reqById: ReadonlyMap<string, TracedRequest>;             // request lookup by ID
  endpointGroups: ReadonlyMap<string, EndpointGroup>;      // aggregated stats per endpoint
}
```

### Step-by-step

**1. Add your rule ID to the `InsightType` union in `src/analysis/insights/types.ts`:**

```typescript
export type InsightType =
  | "n1" | "cross-endpoint" | /* ... existing types ... */
  | "my-rule";
```

**2. Create `src/analysis/insights/rules/<rule-name>.ts`:**

```typescript
import type { InsightRule } from "../rule.js";
import type { Insight, PreparedInsightContext } from "../types.js";

export const myRule: InsightRule = {
  id: "my-rule",
  check(ctx: PreparedInsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const [endpoint, group] of ctx.endpointGroups) {
      // Your detection logic using pre-computed indexes.
      if (/* condition */) {
        insights.push({
          severity: "warning",
          type: "my-rule",
          title: "Human Readable Title",
          desc: `${endpoint} — description of what was found`,
          hint: "Actionable suggestion for how to fix this.",
          nav: "requests",  // dashboard tab to link to
        });
      }
    }

    return insights;
  },
};
```

**3. Register it in `src/analysis/insights/index.ts`:**

```typescript
import { myRule } from "./rules/my-rule.js";

export function createDefaultInsightRunner(): InsightRunner {
  const runner = new InsightRunner();
  // ... existing rules ...
  runner.register(myRule);
  return runner;
}
```

### Key rules

- **Use `PreparedInsightContext` indexes.** Don't re-group queries by request —
  `ctx.queriesByReq` already has that. Don't re-aggregate endpoint stats —
  `ctx.endpointGroups` already has that.
- **Use constants from `src/constants/thresholds.ts`.** Never hardcode magic
  numbers. Add new threshold constants there if needed.
- **Use utilities from `src/utils/`.** `formatDuration()`, `pct()`,
  `getEndpointKey()`, `getQueryShape()` — reuse existing helpers.
- **Set `nav` to the relevant dashboard tab.** Valid values: `"requests"`,
  `"queries"`, `"graph"`. This controls where the user is taken when clicking
  the insight.
- **Keep rules isolated.** Each rule file should be independent. If you need
  shared logic across multiple insight rules, add it to `query-helpers.ts` or
  `prepare.ts`.

---

## Building a language SDK

Brakit exposes an HTTP ingest endpoint that any language can POST events to.
This is how you add brakit support for Python, Go, Ruby, or any other runtime.

In Node.js, brakit runs in-process via `import 'brakit'` and captures events
automatically. For other languages, the SDK sends events to brakit's ingest
endpoint over HTTP.

### Protocol

**Endpoint:** `POST http://localhost:<PORT>/__brakit/api/ingest`

The port is the same port your HTTP server listens on (brakit intercepts
requests in-process).

**Payload:**

```json
{
  "_brakit": true,
  "version": 1,
  "sdk": "brakit-python/0.1.0",
  "events": [
    {
      "type": "db.query",
      "requestId": "uuid-from-x-brakit-request-id-header",
      "timestamp": 1708000000000,
      "data": {
        "operation": "SELECT",
        "table": "users",
        "duration": 45,
        "source": "django-orm",
        "sql": "SELECT * FROM users WHERE id = %s",
        "rowCount": 1
      }
    }
  ]
}
```

**Response:** `204 No Content` on success, `400` on invalid payload.

### Event types

| Type | Required `data` fields | Optional `data` fields |
|------|----------------------|----------------------|
| `db.query` | `operation`, `table`, `duration` | `sql`, `source`, `rowCount`, `model` |
| `fetch` | `url`, `method`, `statusCode`, `duration` | — |
| `log` | `level`, `message` | — |
| `error` | `name`, `message` | `stack` |
| `auth.check` | `provider` | `result` |

`duration` is in milliseconds. `level` is one of `log`, `warn`, `error`,
`info`, `debug`. `operation` is one of `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
`OTHER`.

### Request correlation

When running in proxy mode (`npx brakit`), brakit injects an
`x-brakit-request-id` header on every request forwarded to your dev server.
Your SDK should:

1. Read this header from incoming HTTP requests.
2. Store it in a request-scoped context (thread-local, context var, etc.).
3. Include it as `requestId` in every event emitted during that request.

This is how database queries, fetch calls, and logs are correlated back to the
HTTP request that triggered them.

### Batching

Buffer events and flush periodically (every 50-100ms) or when the buffer
reaches a threshold (20 events). Use fire-and-forget HTTP — don't block on
the response. If brakit isn't running, silently drop events.

### Minimal SDK structure

```
brakit-<language>/
  src/
    transport.py     # Batched HTTP POST to ingest endpoint
    context.py       # Request-scoped storage for requestId
    middleware.py     # HTTP middleware to extract x-brakit-request-id
    adapters/
      django.py      # Patches Django ORM query execution
      sqlalchemy.py  # Patches SQLAlchemy engine.execute
```

The SDK should auto-detect installed libraries (like the Node.js adapter
registry) and patch only those found.

---

## How to contribute

### Submitting a pull request

1. [Fork the repository](https://github.com/brakit-ai/brakit/fork) and create
   a branch from `main`.
2. Focus on a single change — one adapter, one rule, one fix.
3. Run `npm run build && npm test` before pushing.
4. Open a pull request with a clear title and description of what it does.
5. If it addresses an open issue, reference it in the PR body (`Fixes #123`).

For larger changes (new module, architectural shift), please open an issue
first so we can discuss the approach before you invest time.

### Reporting bugs

Check [existing issues](https://github.com/brakit-ai/brakit/issues) first. If
yours isn't listed, [open a new one](https://github.com/brakit-ai/brakit/issues/new?labels=bug)
with steps to reproduce, expected behavior, and your Node.js version.

### Feature requests

[Open an issue](https://github.com/brakit-ai/brakit/issues/new?labels=enhancement)
describing the use case and why it matters. We're especially interested in new
database adapters, insight rules, and dashboard improvements.

---

## Code style

- TypeScript strict mode. No `any` unless interfacing with untyped libraries.
- ESM only (`"type": "module"` in package.json).
- Comments only where the logic isn't self-evident. No JSDoc for obvious
  parameters.
- Prefer `const` and immutable patterns. Mutation is fine in hot paths
  (stores, transport buffer).
- Keep files focused. One adapter per file, one rule per file, one concern per
  module.
- Constants in `src/constants/`. No hardcoded magic numbers in rule or adapter
  files.

## Commit messages

Use imperative mood, one line: `Add drizzle adapter`, `Fix N+1 false positive
on polymorphic queries`, `Expand ingest protocol with auth.check event type`.

## License

By contributing, you agree that your work will be licensed under Brakit's
[MIT License](LICENSE).

## Questions?

Open an issue at https://github.com/brakit-ai/brakit/issues. For architectural
questions, read [docs/design/architecture.md](docs/design/architecture.md)
first.
