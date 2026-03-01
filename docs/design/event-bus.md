# EventBus

Typed publish-subscribe system for inter-module communication. Replaces the old `transport.ts` module-level `send()`/`setEmitter()` pattern and per-store `onEntry`/`offEntry` subscriptions.

## ChannelMap

Every event channel is defined in `src/core/event-bus.ts`:

```typescript
interface ChannelMap {
  "telemetry:fetch":   Omit<TracedFetch, "id">;
  "telemetry:query":   Omit<TracedQuery, "id">;
  "telemetry:log":     Omit<TracedLog, "id">;
  "telemetry:error":   Omit<TracedError, "id">;
  "request:completed": TracedRequest;
  "analysis:updated":  AnalysisUpdate;
  "store:cleared":     void;
}
```

Adding a new telemetry type means adding one line here. TypeScript enforces that all producers and consumers use the correct payload type.

## Channel naming

Channels follow `domain:event` convention:

- `telemetry:*` — raw telemetry from hooks and SDKs
- `request:*` — HTTP request lifecycle
- `analysis:*` — computed insights and findings
- `store:*` — store-level operations

## Flow

```
Hooks/Adapters → bus.emit("telemetry:*") → stores (via bus.on in setup.ts)
                                          → SSE handler (via bus.on)
                                          → analysis engine (triggers recompute)

Analysis Engine → bus.emit("analysis:updated") → SSE handler
                                                → terminal display
```

## Adding a new channel

1. Add the channel + payload type to `ChannelMap` in `src/core/event-bus.ts`
2. Emit from the producer: `bus.emit("your:channel", data)`
3. Subscribe from consumers: `bus.on("your:channel", (data) => ...)`

No switch-case routing. No manual subscribe/unsubscribe pairing. TypeScript checks the payload at every call site.

## SubscriptionBag

Group multiple bus subscriptions for batch disposal:

```typescript
const subs = new SubscriptionBag();
subs.add(bus.on("telemetry:fetch", handler1));
subs.add(bus.on("telemetry:log", handler2));

// Later, one call cleans up everything:
subs.dispose();
```

Used by SSE handler (per-connection cleanup) and analysis engine (on stop).
