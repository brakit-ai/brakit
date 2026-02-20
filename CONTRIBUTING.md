# Contributing to Brakit

Brakit is designed so that the most common contributions — adding support for a
new database library or adding a new security rule — require exactly one file
and one interface. This guide covers the three main contribution paths.

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
| `dist/index.js` | Public library API |
| `dist/bin/brakit.js` | CLI binary |
| `dist/instrument/preload.js` | Node.js `--import` hook |

During development, `npm run dev` runs tsup in watch mode. Tests use vitest
(`npm test` or `npm run test:watch`).

## Project structure

```
src/
  analysis/          # Flow grouping, insights, and security rules
    rules/           # SecurityRule implementations (one file per rule)
  cli/               # CLI command definitions (citty)
  constants/         # Shared thresholds, route paths, limits
  dashboard/         # HTML dashboard, REST API handlers, SSE
    api/             # API route handlers
    client/          # Client-side template-literal JavaScript
  detect/            # Framework auto-detection
  instrument/        # Node.js --import instrumentation
    adapters/        # BrakitAdapter implementations (one file per library)
    hooks/           # Core runtime hooks (fetch, console, errors, context)
  lifecycle/         # Startup and shutdown orchestration
  process/           # Dev server spawning
  proxy/             # HTTP reverse proxy
  store/             # In-memory bounded stores with pub/sub
  types/             # TypeScript type definitions
tests/
docs/
  design/            # Architecture design documents
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

## Building a language SDK

Brakit exposes an HTTP ingest endpoint that any language can POST events to.
This is how you add brakit support for Python, Go, Ruby, or any other runtime.

### Protocol

**Endpoint:** `POST http://localhost:<BRAKIT_PORT>/__brakit/api/ingest`

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

The brakit proxy injects an `x-brakit-request-id` header on every request
forwarded to your dev server. Your SDK should:

1. Read this header from incoming HTTP requests.
2. Store it in a request-scoped context (thread-local, context var, etc.).
3. Include it as `requestId` in every event emitted during that request.

This is how database queries, fetch calls, and logs are correlated back to the
HTTP request that triggered them.

### Batching

Buffer events and flush periodically (every 50-100ms) or when the buffer
reaches a threshold (20 events). Use fire-and-forget HTTP — don't block on
the response. If the brakit proxy isn't running, silently drop events.

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

## Code style

- TypeScript strict mode. No `any` unless interfacing with untyped libraries.
- ESM only (`"type": "module"` in package.json).
- Comments only where the logic isn't self-evident. No JSDoc for obvious
  parameters.
- Prefer `const` and immutable patterns. Mutation is fine in hot paths
  (stores, transport buffer).
- Keep files focused. One adapter per file, one rule per file, one concern per
  module.

## Commit messages

Use imperative mood, one line: `Add drizzle adapter`, `Fix N+1 false positive
on polymorphic queries`, `Expand ingest protocol with auth.check event type`.

## Questions?

Open an issue at https://github.com/brakit-ai/brakit/issues. For architectural
questions, read [docs/design/architecture.md](docs/design/architecture.md)
first.
