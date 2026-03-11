# Safety Guarantees

Brakit runs inside your HTTP server process. If brakit throws, your app could crash. This is unacceptable — a developer tool must never break the application it's monitoring.

This document describes the 5 layers of protection that enforce this guarantee.

## Table of contents

- [The guarantee](#the-guarantee)
- [Where safety fits in the system](#where-safety-fits-in-the-system)
- [Layer 1: Activation guards](#layer-1-activation-guards)
- [Layer 2: safeWrap](#layer-2-safewrap)
- [Layer 3: Circuit breaker](#layer-3-circuit-breaker)
- [Layer 4: Bounded stores](#layer-4-bounded-stores)
- [Layer 5: Silent failures](#layer-5-silent-failures)
- [What to do if brakit interferes](#what-to-do-if-brakit-interferes)

---

## The guarantee

Every brakit code path that touches your app follows one rule: **if brakit fails, the original behavior must run as if brakit wasn't there.**

This is enforced at every layer, not just at the top. A failed console hook still logs your message. A failed fetch hook still makes the request. A failed response capture still sends the response.

## Where safety fits in the system

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Activation Guards                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Layer 2: safeWrap (every monkey-patch)                   │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Layer 3: Circuit Breaker                           │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │  Layer 4: Bounded Stores                      │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │  Layer 5: Silent Failures               │  │  │  │  │
│  │  │  │  │                                         │  │  │  │  │
│  │  │  │  │  ┌─────────────────────────────────┐    │  │  │  │  │
│  │  │  │  │  │  Brakit Runtime                 │    │  │  │  │  │
│  │  │  │  │  │  Interceptor, Hooks, Adapters,  │    │  │  │  │  │
│  │  │  │  │  │  Stores, Analysis, Dashboard    │    │  │  │  │  │
│  │  │  │  │  └─────────────────────────────────┘    │  │  │  │  │
│  │  │  │  │                                         │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 ┌──────────────────────┐
                 │  Your HTTP Server    │
                 │  (always unaffected) │
                 └──────────────────────┘
```

Each layer wraps the next. If an inner layer fails, the outer layer catches it. The outermost layer (activation guards) prevents brakit from running at all in unsafe environments.

---

## Layer 1: Activation guards

Brakit does not activate in environments where developer tooling has no place.

`src/runtime/activate.ts` checks four conditions:

| Check | Condition |
|-------|-----------|
| Explicit disable | `BRAKIT_DISABLE=true` |
| Production/staging | `NODE_ENV` is `production` or `staging` |
| CI environments | `CI` environment variable is set |
| Cloud platforms | Detects 19 cloud/serverless signals: `VERCEL`, `VERCEL_ENV`, `NETLIFY`, `AWS_LAMBDA_FUNCTION_NAME`, `AWS_EXECUTION_ENV`, `ECS_CONTAINER_METADATA_URI`, `GOOGLE_CLOUD_PROJECT`, `GCP_PROJECT`, `K_SERVICE` (Cloud Run), `AZURE_FUNCTIONS_ENVIRONMENT`, `WEBSITE_SITE_NAME`, `FLY_APP_NAME`, `RAILWAY_ENVIRONMENT`, `RENDER`, `HEROKU_APP_NAME`, `DYNO`, `CF_INSTANCE_GUID`, `CF_PAGES` (Cloudflare Pages), `KUBERNETES_SERVICE_HOST` |

If any check matches, brakit stays completely dormant. No hooks installed, no monkey-patches applied, no memory allocated.

---

## Layer 2: safeWrap

Every monkey-patch brakit applies is wrapped with `safeWrap` (`src/runtime/safe-wrap.ts`).

The pattern:

```typescript
const patched = safeWrap(original, (original, ...args) => {
  // brakit's instrumentation logic
  captureData(args);
  return original.apply(this, args);
});
```

If the wrapper throws, `safeWrap` catches the exception, reports it to the health monitor, and calls the original function directly. Your app sees the correct return value regardless.

There are two variants:

- **`safeWrap`** — For synchronous functions (console methods, `res.write`, `res.end`)
- **`safeWrapAsync`** — For async functions. Catches both synchronous throws and rejected promises

Both check `health.isActive()` before running the wrapper. If the circuit breaker has tripped, they skip the wrapper entirely and call the original directly. Zero overhead.

---

## Layer 3: Circuit breaker

`src/runtime/health.ts` tracks how many errors brakit has encountered. If the count exceeds `MAX_HEALTH_ERRORS` (10), brakit disables itself.

```
Error count exceeds MAX_HEALTH_ERRORS
  -> health.isActive() returns false
  -> all safeWrap wrappers pass through to originals
  -> teardown function runs (cleans up intervals, listeners)
  -> console.warn tells the developer what happened

After RECOVERY_WINDOW_MS (5 minutes):
  -> error count resets
  -> health.isActive() returns true again
  -> instrumentation resumes
```

The circuit breaker self-heals. A transient burst of errors (e.g. a malformed response during a bad deploy) disables brakit temporarily, then it recovers automatically without requiring a server restart. This prevents a single bad state from permanently losing observability for the rest of the session.

---

## Layer 4: Bounded stores

Every in-memory store has a fixed capacity (1,000 entries by default). When a store is full, the oldest entry is evicted before the new one is added.

This guarantees:

- Memory usage is capped regardless of traffic volume
- A long-running dev session won't OOM
- No unbounded arrays, no growing Maps

The MetricsStore and IssueStore persist to `.brakit/metrics.json` and `.brakit/issues.json` using `AtomicWriter`: writes go to a temp file first, then rename, so a crash during write never corrupts the file.

---

## Layer 5: Silent failures

All capture-related errors are silently swallowed:

- A response body that can't be decompressed? Stored without a body.
- A database query that can't be normalized? Stored with `operation: "OTHER"`.
- A console argument that can't be serialized? Stored as `"[unserializable]"`.
- An insight rule that throws? Skipped, other rules still run.
- A security rule that throws? Same: one rule failing doesn't stop the scanner.

None of these become runtime errors in your app. Brakit prefers incomplete data over crashing.

---

## What to do if brakit interferes

If you suspect brakit is affecting your app's behavior:

1. **Quick disable:** Set `BRAKIT_DISABLE=true` in your environment
2. **Check terminal:** If the circuit breaker tripped, you'll see a warning in the console. It will self-recover after 5 minutes, or you can restart your dev server.
3. **Report it:** Open an issue at https://github.com/brakit-ai/brakit/issues with the error output. This is a bug — brakit should never interfere.
