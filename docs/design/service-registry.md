# ServiceRegistry

Brakit has ~10 services (stores, bus, analysis engine) that many modules need access to. Before the ServiceRegistry, each service was a module-level singleton — `export const defaultFetchStore = new FetchStore()`. Consumers imported these globals directly, creating hidden dependencies that were impossible to mock without `jest.mock()` and impossible to trace without grep.

The ServiceRegistry replaces this with explicit, typed dependency injection. All services are registered once at startup. Consumers receive the registry and call `get()` to access what they need.

## Table of contents

- [Why the ServiceRegistry exists](#why-the-serviceregistry-exists)
- [How the registry fits in the system](#how-the-registry-fits-in-the-system)
- [Core principles](#core-principles)
- [ServiceMap](#servicemap)
- [Registration](#registration)
- [Consuming services](#consuming-services)
- [Adding a new service](#adding-a-new-service)
- [Testing](#testing)
- [Anti-patterns](#anti-patterns)

---

## Why the ServiceRegistry exists

Module-level singletons create three problems:

1. **Hidden dependencies.** A function that imports `defaultQueryStore` has an invisible dependency. You only discover it by reading the import list or when a test fails.
2. **Untestable.** To test a function that imports a global store, you need `jest.mock()` or module-level patching. This is fragile, couples tests to file paths, and breaks when files move.
3. **Initialization order.** Singletons are created when their module is first imported. In a complex app, this means service creation order depends on import order — a source of subtle bugs.

The registry solves all three: dependencies are explicit (passed as `registry`), testable (create a mock registry with fake stores), and ordered (everything is created in `setup.ts` in a defined sequence).

## How the registry fits in the system

```
setup.ts creates everything, registers it, then passes the registry to consumers:

┌─────────────────────────────────────────────────────────────────┐
│  setup.ts (startup)                                             │
│                                                                 │
│  1. Create primitives         2. Register all services          │
│  ┌──────────────┐             ┌──────────────────────────────┐  │
│  │ EventBus     │────────────▶│        ServiceRegistry       │  │
│  │ RequestStore │────────────▶│                              │  │
│  │ QueryStore   │────────────▶│  "event-bus"      → EventBus │  │
│  │ FetchStore   │────────────▶│  "request-store"  → ReqStore │  │
│  │ LogStore     │────────────▶│  "query-store"    → QryStore │  │
│  │ ErrorStore   │────────────▶│  "fetch-store"    → FetStore │  │
│  │ MetricsStore │────────────▶│  "log-store"      → LogStore │  │
│  │ IssueStore   │────────────▶│  "error-store"    → ErrStore │  │
│  │ AnalysisEng  │────────────▶│  "metrics-store"  → MetStore │  │
│  └──────────────┘             │  "issue-store"    → IssStore │  │
│                               │  "analysis-engine"→ Engine   │  │
│                               └──────────┬───────────────────┘  │
│                                          │                      │
│  3. Pass registry to consumers           │                      │
│  ┌───────────────────────────────────────┘                      │
│  │                                                              │
│  ▼                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Interceptor  │  │ SSE Handler  │  │ Dashboard API routes │   │
│  │  registry    │  │  registry    │  │  registry            │   │
│  │  .get(...)   │  │  .get(...)   │  │  .get(...)           │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

The registry is the single wiring point. Services are created once, registered once, and accessed everywhere through `registry.get()`.

---

## Core principles

1. **One registry** — A single `ServiceRegistry` instance, created in `setup.ts`, passed to all consumers.
2. **Register once at startup** — All `registry.register()` calls happen in `setup.ts`. After that, the registry is read-only.
3. **Consumers only call get()** — Modules that need services receive the registry through their constructor or factory function. They never import stores directly.

---

## ServiceMap

Every service is declared in `src/core/service-registry.ts`:

```typescript
interface ServiceMap {
  "event-bus": EventBus;
  "request-store": RequestStoreInterface;
  "query-store": TelemetryStoreInterface<TracedQuery>;
  "fetch-store": TelemetryStoreInterface<TracedFetch>;
  "log-store": TelemetryStoreInterface<TracedLog>;
  "error-store": TelemetryStoreInterface<TracedError>;
  "metrics-store": MetricsStoreInterface;
  "issue-store": IssueStoreInterface;
  "analysis-engine": AnalysisEngineInterface;
}
```

TypeScript enforces that `registry.get("query-store")` returns `TelemetryStoreInterface<TracedQuery>` — no casts, no `as any`. If you misspell a service name, the compiler catches it.

---

## Registration

All services are wired in `src/runtime/setup.ts`:

```typescript
const registry = new ServiceRegistry();
const bus = new EventBus();
const requestStore = new RequestStore();
const queryStore = new QueryStore();
// ...

registry.register("event-bus", bus);
registry.register("request-store", requestStore);
registry.register("query-store", queryStore);
registry.register("fetch-store", fetchStore);
registry.register("log-store", logStore);
registry.register("error-store", errorStore);
registry.register("metrics-store", metricsStore);
registry.register("issue-store", issueStore);
registry.register("analysis-engine", engine);
```

Registration happens once at startup. After that, consumers only call `registry.get()`.

---

## Consuming services

Any module that needs a service receives the registry:

```typescript
export function createSSEHandler(registry: ServiceRegistry) {
  const bus = registry.get("event-bus");
  // ...
}

export class AnalysisEngine {
  constructor(private registry: ServiceRegistry) { ... }
}
```

Factory functions and constructors take `registry` instead of individual dependencies. This keeps function signatures stable — adding a new service to the map doesn't change any existing consumer's signature.

---

## Adding a new service

1. Define the service interface in `src/types/services.ts`
2. Add the key + type to `ServiceMap` in `src/core/service-registry.ts`
3. Instantiate and register in `setup.ts`: `registry.register("my-service", instance)`
4. Access from consumers: `registry.get("my-service")`

---

## Testing

Create a registry with mock implementations:

```typescript
const bus = new EventBus();
const registry = new ServiceRegistry();
registry.register("event-bus", bus);
registry.register("query-store", {
  getAll: () => mockQueries,
  getByRequest: () => [],
  add: (d) => ({ id: "1", ...d }),
  clear: () => {},
});

// Pass to the module under test
const engine = new AnalysisEngine(registry);
```

No module patching. No `jest.mock()`. No global state cleanup between tests. Each test creates its own registry with exactly the services it needs.

---

## Anti-patterns

**Don't import store classes directly in consumers.** If you see `import { defaultQueryStore } from "../store/query-store.js"` in a consumer module, it's wrong. The consumer should receive the registry and call `registry.get("query-store")`. Direct imports bypass the registry and reintroduce hidden dependencies.

**Don't call `registry.register()` outside `setup.ts`.** Registration is a startup-time operation. If services register themselves lazily or from multiple locations, initialization order becomes unpredictable and debugging becomes harder.

**Don't pass individual stores when you can pass the registry.** Prefer `createHandler(registry)` over `createHandler(fetchStore, logStore, errorStore)`. The registry keeps function signatures stable and makes it trivial to access additional services later without changing the signature.

**Don't use the registry as a global.** The registry should flow through constructors and factory functions, not be imported as a module-level singleton. That would defeat the entire purpose.
