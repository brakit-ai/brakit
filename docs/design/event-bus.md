# EventBus

Brakit's modules need to communicate without knowing about each other. The fetch hook shouldn't import the SSE handler. The analysis engine shouldn't import the terminal display. But when a query is captured, all of them need to know about it.

The EventBus solves this with typed publish-subscribe channels. Producers emit events. Consumers subscribe. TypeScript enforces that the payload matches at every call site.

## Table of contents

- [Why the EventBus exists](#why-the-eventbus-exists)
- [Core principles](#core-principles)
- [ChannelMap](#channelmap)
- [Channel naming](#channel-naming)
- [Where the EventBus fits in the system](#where-the-eventbus-fits-in-the-system)
- [Data flow](#data-flow)
- [Producing events](#producing-events)
- [Consuming events](#consuming-events)
- [SubscriptionBag](#subscriptionbag)
- [Adding a new channel](#adding-a-new-channel)
- [Anti-patterns](#anti-patterns)

---

## Why the EventBus exists

Before the EventBus, adding a new telemetry type (e.g., WebSocket messages) required changes in 7 files: type definition, store, store export, route switch, SSE handler subscriptions, analysis engine subscriptions, and API handler imports.

After: add one line to `ChannelMap`, create the store, wire it in `setup.ts`. SSE, analysis, and terminal automatically see it through the bus.

Before: disconnecting an SSE client required 6 manual `offEntry`/`offRequest`/`offUpdate` calls paired with their corresponding `on` calls.

After: `subs.dispose()`.

---

## Core principles

1. **One ChannelMap** — Every event channel is declared in a single TypeScript interface. If a channel isn't in the map, it doesn't exist.
2. **Typed payloads** — `bus.emit("telemetry:fetch", data)` won't compile if `data` doesn't match `Omit<TracedFetch, "id">`. No runtime checks needed.
3. **Dispose via SubscriptionBag** — Never manually pair subscribe/unsubscribe calls. Group subscriptions and dispose them together.

---

## ChannelMap

Every event channel is defined in `src/core/event-bus.ts`:

```typescript
interface ChannelMap {
  "telemetry:fetch": Omit<TracedFetch, "id">;
  "telemetry:query": Omit<TracedQuery, "id">;
  "telemetry:log": Omit<TracedLog, "id">;
  "telemetry:error": Omit<TracedError, "id">;
  "request:completed": TracedRequest;
  "analysis:updated": AnalysisUpdate;
  "issues:changed": readonly StatefulIssue[];
  "store:cleared": undefined;
}

// AnalysisUpdate carries the full computed state after each recompute cycle:
interface AnalysisUpdate {
  insights: readonly Insight[];
  findings: readonly SecurityFinding[];
  issues: readonly StatefulIssue[];
}
```

Adding a new telemetry type means adding one line here. TypeScript enforces that all producers and consumers use the correct payload type.

---

## Channel naming

Channels follow a `domain:event` convention:

| Prefix        | Domain                            | Examples                             |
| ------------- | --------------------------------- | ------------------------------------ |
| `telemetry:*` | Raw telemetry from hooks and SDKs | `telemetry:fetch`, `telemetry:query` |
| `request:*`   | HTTP request lifecycle            | `request:completed`                  |
| `analysis:*`  | Computed insights and findings    | `analysis:updated`                   |
| `issues:*`    | Issue lifecycle state changes     | `issues:changed`                     |
| `store:*`     | Store-level operations            | `store:cleared`                      |

Prefer this convention when adding new channels. It keeps the bus scannable and groups related events.

---

## Where the EventBus fits in the system

```
┌──────────────────────────────────────────────────────────────────┐
│  Your HTTP Server (Node.js process)                              │
│                                                                  │
│  ┌────────────────┐                                              │
│  │ Interceptor    │──▶ request:completed ─┐                      │
│  └────────────────┘                       │                      │
│  ┌────────────────┐                       │                      │
│  │ Fetch Hook     │──▶ telemetry:fetch  ──┤                      │
│  └────────────────┘                       │                      │
│  ┌────────────────┐                       ▼                      │
│  │ Console Hook   │──▶ telemetry:log  ──▶ ╔═══════════╗          │
│  └────────────────┘                       ║  EventBus ║          │
│  ┌────────────────┐                       ╚═════╤═════╝          │
│  │ Error Hook     │──▶ telemetry:error ──┘      │                │
│  └────────────────┘                             │                │
│  ┌────────────────┐                             │                │
│  │ DB Adapters    │──▶ telemetry:query ──┘      │                │
│  └────────────────┘                             │                │
│                                    ┌────────────┼────────────┐   │
│                                    ▼            ▼            ▼   │
│                              ┌──────────┐ ┌──────────┐ ┌───────┐ │
│                              │  Stores  │ │ Analysis │ │ SSE   │ │
│                              │ (7 total)│ │  Engine  │ │Handler│ │
│                              └──────────┘ └────┬─────┘ └──▲────┘ │
│                                                │          │      │
│                                                └──────────┘      │
│                                          analysis:updated        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼ SSE
                                                  ┌──────────┐
                                                  │ Browser  │
                                                  │/__brakit │
                                                  └──────────┘
```

## Data flow

Events flow in one direction. Producers emit, consumers react. There is no request-response pattern on the bus — if a consumer needs to query data, it reads from a store via the ServiceRegistry.

---

## Producing events

Hooks and adapters receive an `emit` callback from `setup.ts`:

```typescript
// In setup.ts — construct the emit callback from the bus
const telemetryEmit = (event: TelemetryEvent) => {
  bus.emit(`telemetry:${event.type}`, event.data);
};

// Pass to hooks
setupFetchHook(telemetryEmit);
setupConsoleHook(telemetryEmit);
setupErrorHook(telemetryEmit);
```

Hooks don't import the EventBus. They receive a plain function. This keeps them decoupled — a hook can be tested by passing a mock emit function.

The analysis engine emits computed results after recompute:

```typescript
bus.emit("analysis:updated", {
  insights,    // Insight[] from performance rules
  findings,    // SecurityFinding[] from security rules
  issues,      // StatefulIssue[] with full lifecycle state
});
```

---

## Consuming events

The SSE handler subscribes to all channels and forwards events to the browser:

```typescript
const bus = registry.get("event-bus");
const subs = new SubscriptionBag();

subs.add(
  bus.on("request:completed", (r) => writeEvent(null, JSON.stringify(r))),
);
subs.add(
  bus.on("telemetry:fetch", (e) => writeEvent("fetch", JSON.stringify(e))),
);
subs.add(
  bus.on("telemetry:query", (e) => writeEvent("query", JSON.stringify(e))),
);
subs.add(
  bus.on("analysis:updated", (u) => {
    writeEvent("issues", JSON.stringify(u.issues));
    writeEvent("insights", JSON.stringify(u.insights));
    writeEvent("security", JSON.stringify(u.findings));
  }),
);

req.on("close", () => subs.dispose());
```

The analysis engine subscribes to telemetry channels to trigger recomputes:

```typescript
this.subs.add(bus.on("request:completed", () => this.scheduleRecompute()));
this.subs.add(bus.on("telemetry:query", () => this.scheduleRecompute()));
this.subs.add(bus.on("telemetry:error", () => this.scheduleRecompute()));
```

---

## SubscriptionBag

Group multiple bus subscriptions for batch disposal:

```typescript
const subs = new SubscriptionBag();
subs.add(bus.on("telemetry:fetch", handler1));
subs.add(bus.on("telemetry:log", handler2));

// Later, one call cleans up everything:
subs.dispose();
```

`bus.on()` returns a dispose function. `SubscriptionBag.add()` accepts it. `bus.off(channel, fn)` also exists as a direct unsubscribe, but prefer `SubscriptionBag` for any code that manages multiple subscriptions — it avoids the error-prone manual pairing of every `on` with an `off`.

Used by:

- **SSE handler** — per-connection cleanup when the browser disconnects
- **Analysis engine** — cleanup on `stop()`
- **Terminal display** — cleanup on shutdown

---

## Adding a new channel

1. Add the channel + payload type to `ChannelMap` in `src/core/event-bus.ts`
2. Emit from the producer: `bus.emit("your:channel", data)`
3. Subscribe from consumers: `bus.on("your:channel", (data) => ...)`

No switch-case routing. No manual subscribe/unsubscribe pairing. TypeScript checks the payload at every call site.

---

## Anti-patterns

**Don't subscribe to store entry callbacks when a bus channel exists.** Stores still have `onEntry` callbacks internally, but consumers should prefer the bus. The bus provides a uniform subscription model with `SubscriptionBag` cleanup, while store callbacks require manual pairing.

**Don't forget to dispose subscriptions.** Every `bus.on()` call allocates a listener. If you subscribe in a per-request or per-connection context (like SSE), failing to dispose leaks memory. Always use `SubscriptionBag` and dispose on cleanup.

**Don't emit inside an emit handler.** If channel A's handler emits on channel B, and B's handler emits on channel A, you get an infinite loop. The bus doesn't guard against this. If you need derived events, schedule them asynchronously (like the analysis engine's debounced recompute).

**Don't use the bus for request-response patterns.** The bus is fire-and-forget. If a consumer needs data, it should read from a store via the ServiceRegistry, not request it through the bus.
