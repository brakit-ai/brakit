import { describe, it, expect, vi, beforeEach } from "vitest";
import { MetricsStore } from "../../src/store/metrics/metrics-store.js";
import type { MetricsPersistence } from "../../src/store/metrics/persistence.js";
import type { MetricsData } from "../../src/types/index.js";
import type { TracedRequest, RequestMetrics } from "../../src/types/index.js";

function createMockPersistence(): MetricsPersistence & { saveCalls: number } {
  let saveCalls = 0;
  return {
    get saveCalls() { return saveCalls; },
    load: () => ({ version: 1, endpoints: [] }),
    loadAsync: async () => ({ version: 1, endpoints: [] }),
    save(_data: MetricsData) { saveCalls++; },
    saveSync(_data: MetricsData) { saveCalls++; },
    remove: vi.fn(),
  };
}

function makeRequest(overrides: Partial<TracedRequest> = {}): TracedRequest {
  return {
    id: "req-1",
    method: "GET",
    url: "/api/test",
    path: "/api/test",
    headers: {},
    requestBody: null,
    statusCode: 200,
    responseHeaders: {},
    responseBody: null,
    startedAt: performance.now() - 50,
    durationMs: 50,
    responseSize: 100,
    isStatic: false,
    ...overrides,
  };
}

const defaultMetrics: RequestMetrics = {
  queryCount: 0,
  queryTimeMs: 0,
  fetchTimeMs: 0,
};

describe("MetricsStore dirty tracking", () => {
  let persistence: ReturnType<typeof createMockPersistence>;
  let store: MetricsStore;

  beforeEach(() => {
    persistence = createMockPersistence();
    store = new MetricsStore(persistence);
  });

  it("does not write to disk when no requests have been recorded", () => {
    store.flush();
    expect(persistence.saveCalls).toBe(0);
  });

  it("writes to disk after a request is recorded", () => {
    store.recordRequest(makeRequest(), defaultMetrics);
    store.flush();
    expect(persistence.saveCalls).toBe(1);
  });

  it("does not write again if no new requests since last flush", () => {
    store.recordRequest(makeRequest(), defaultMetrics);
    store.flush();
    store.flush(); // second flush with no new data
    expect(persistence.saveCalls).toBe(1);
  });

  it("reset clears dirty flag and removes file", () => {
    store.recordRequest(makeRequest(), defaultMetrics);
    store.reset();
    store.flush(); // should NOT write since reset cleared dirty
    expect(persistence.saveCalls).toBe(0);
    expect(persistence.remove).toHaveBeenCalled();
  });

  it("skips static requests", () => {
    store.recordRequest(makeRequest({ isStatic: true }), defaultMetrics);
    store.flush();
    expect(persistence.saveCalls).toBe(0);
  });
});
