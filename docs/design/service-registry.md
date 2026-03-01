# ServiceRegistry

Typed service locator for dependency injection. Replaces module-level singletons (`defaultFetchStore`, `defaultLogStore`, etc.) and implicit global imports.

## ServiceMap

Every service is declared in `src/core/service-registry.ts`:

```typescript
interface ServiceMap {
  "event-bus":       EventBus;
  "request-store":   RequestStoreInterface;
  "query-store":     TelemetryStoreInterface<TracedQuery>;
  "fetch-store":     TelemetryStoreInterface<TracedFetch>;
  "log-store":       TelemetryStoreInterface<TracedLog>;
  "error-store":     TelemetryStoreInterface<TracedError>;
  "metrics-store":   MetricsStoreInterface;
  "finding-store":   FindingStoreInterface;
  "analysis-engine": AnalysisEngineInterface;
}
```

TypeScript enforces that `registry.get("query-store")` returns `TelemetryStoreInterface<TracedQuery>` — no casts, no `as any`.

## Registration

All services are wired in `src/runtime/setup.ts`:

```typescript
const registry = new ServiceRegistry();
const bus = new EventBus();

registry.register("event-bus", bus);
registry.register("request-store", requestStore);
registry.register("query-store", queryStore);
// ...
```

Registration happens once at startup. After that, consumers only call `registry.get()`.

## Consuming services

Any module that needs a service receives the registry:

```typescript
export function createSSEHandler(registry: ServiceRegistry) {
  const bus = registry.get("event-bus");
  // ...
}
```

Factory functions and constructors take `registry` instead of individual dependencies. This keeps function signatures stable when adding new services.

## Adding a new service

1. Define the service interface in `src/types/services.ts`
2. Add the key + type to `ServiceMap` in `src/core/service-registry.ts`
3. Instantiate and register in `setup.ts`: `registry.register("my-service", instance)`
4. Access from consumers: `registry.get("my-service")`

## Testing

Create a registry with mock implementations:

```typescript
const registry = new ServiceRegistry();
registry.register("event-bus", new EventBus());
registry.register("query-store", { getAll: () => [], getByRequest: () => [], add: (d) => ({ id: "1", ...d }), clear: () => {} });
// pass to the module under test
```

No module patching, no `jest.mock()`, no global state cleanup between tests.
