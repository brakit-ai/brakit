import { describe, it, expect, vi } from "vitest";
import { enrichFindings, enrichEndpoints, enrichRequestDetail } from "../../src/mcp/enrichment.js";
import type { BrakitClient } from "../../src/mcp/client.js";
import { makeSecurityFinding } from "../helpers/mcp-factories.js";
import { makeRequest, makeQuery, makeFetch } from "../helpers/factories.js";
import type { Insight } from "../../src/analysis/insights/types.js";

function makeMockClient(overrides: Partial<Record<keyof BrakitClient, unknown>> = {}): BrakitClient {
  return {
    getSecurityFindings: vi.fn().mockResolvedValue({ findings: [] }),
    getInsights: vi.fn().mockResolvedValue({ insights: [] }),
    getLiveMetrics: vi.fn().mockResolvedValue({ endpoints: [] }),
    getRequests: vi.fn().mockResolvedValue({ total: 0, requests: [] }),
    getActivity: vi.fn().mockResolvedValue({
      requestId: "", total: 0, timeline: [],
      counts: { fetches: 0, logs: 0, errors: 0, queries: 0 },
    }),
    getQueries: vi.fn().mockResolvedValue({ total: 0, entries: [] }),
    getFetches: vi.fn().mockResolvedValue({ total: 0, entries: [] }),
    getErrors: vi.fn().mockResolvedValue({ total: 0, entries: [] }),
    getFindings: vi.fn().mockResolvedValue({ total: 0, findings: [] }),
    clearAll: vi.fn().mockResolvedValue(true),
    isAlive: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as BrakitClient;
}

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    severity: "warning",
    type: "slow",
    title: "Slow endpoint",
    desc: "Endpoint is slow",
    hint: "Optimize it",
    ...overrides,
  };
}

describe("enrichFindings", () => {
  it("returns empty array when no findings exist", async () => {
    const client = makeMockClient();
    const result = await enrichFindings(client);
    expect(result).toHaveLength(0);
  });

  it("maps security findings to enriched format", async () => {
    const finding = makeSecurityFinding({ rule: "sql-injection", title: "SQL Injection", desc: "User input in query" });
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [finding] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("SQL Injection");
    expect(result[0].description).toBe("User input in query");
    expect(result[0].severity).toBe("warning");
  });

  it("includes findingId on enriched findings", async () => {
    const finding = makeSecurityFinding();
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [finding] }),
    });

    const result = await enrichFindings(client);
    expect(result[0].findingId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("includes critical/warning insights", async () => {
    const insight = makeInsight({ severity: "critical", nav: "GET /api/slow" });
    const client = makeMockClient({
      getInsights: vi.fn().mockResolvedValue({ insights: [insight] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("critical");
  });

  it("excludes info severity insights", async () => {
    const insight = makeInsight({ severity: "info" });
    const client = makeMockClient({
      getInsights: vi.fn().mockResolvedValue({ insights: [insight] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(0);
  });

  it("attaches context from request activity data", async () => {
    const finding = makeSecurityFinding({ endpoint: "GET /api/users" });
    const req = makeRequest({ id: "req-1", durationMs: 120 });
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [finding] }),
      getRequests: vi.fn().mockResolvedValue({ total: 1, requests: [req] }),
      getActivity: vi.fn().mockResolvedValue({
        requestId: "req-1", total: 0, timeline: [],
        counts: { fetches: 2, logs: 0, errors: 0, queries: 3 },
      }),
    });

    const result = await enrichFindings(client);
    expect(result[0].context).toContain("120ms");
    expect(result[0].context).toContain("3 DB queries");
    expect(result[0].context).toContain("2 fetches");
  });

  it("handles context enrichment failure gracefully", async () => {
    const finding = makeSecurityFinding();
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [finding] }),
      getRequests: vi.fn().mockRejectedValue(new Error("network error")),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(1);
    expect(result[0].context).toBe("(context unavailable)");
  });
});

describe("enrichEndpoints", () => {
  const mockEndpoints = [
    {
      endpoint: "GET /api/users",
      summary: { p95Ms: 200, errorRate: 0.05, avgQueryCount: 3, totalRequests: 100, avgQueryTimeMs: 10, avgFetchTimeMs: 20, avgAppTimeMs: 170 },
    },
    {
      endpoint: "POST /api/orders",
      summary: { p95Ms: 50, errorRate: 0.2, avgQueryCount: 1, totalRequests: 50, avgQueryTimeMs: 5, avgFetchTimeMs: 0, avgAppTimeMs: 45 },
    },
  ];

  it("maps endpoint data correctly", async () => {
    const client = makeMockClient({
      getLiveMetrics: vi.fn().mockResolvedValue({ endpoints: mockEndpoints }),
    });

    const result = await enrichEndpoints(client);
    expect(result).toHaveLength(2);
    expect(result[0].endpoint).toBe("GET /api/users");
    expect(result[0].p95Ms).toBe(200);
  });

  it("sorts by error_rate", async () => {
    const client = makeMockClient({
      getLiveMetrics: vi.fn().mockResolvedValue({ endpoints: mockEndpoints }),
    });

    const result = await enrichEndpoints(client, "error_rate");
    expect(result[0].endpoint).toBe("POST /api/orders");
  });

  it("sorts by query_count", async () => {
    const client = makeMockClient({
      getLiveMetrics: vi.fn().mockResolvedValue({ endpoints: mockEndpoints }),
    });

    const result = await enrichEndpoints(client, "query_count");
    expect(result[0].endpoint).toBe("GET /api/users");
  });

  it("returns empty array when no endpoints", async () => {
    const client = makeMockClient();
    const result = await enrichEndpoints(client);
    expect(result).toHaveLength(0);
  });
});

describe("enrichRequestDetail", () => {
  it("returns null when no matching request", async () => {
    const client = makeMockClient();
    const result = await enrichRequestDetail(client, { requestId: "nonexistent" });
    expect(result).toBeNull();
  });

  it("returns detail for requestId lookup", async () => {
    const req = makeRequest({ id: "req-1", method: "GET", url: "/api/users", statusCode: 200, durationMs: 50 });
    const query = makeQuery({ parentRequestId: "req-1" });
    const client = makeMockClient({
      getRequests: vi.fn().mockResolvedValue({ total: 1, requests: [req] }),
      getActivity: vi.fn().mockResolvedValue({
        requestId: "req-1", total: 0, timeline: [],
        counts: { fetches: 0, logs: 0, errors: 0, queries: 1 },
      }),
      getQueries: vi.fn().mockResolvedValue({ total: 1, entries: [query] }),
      getFetches: vi.fn().mockResolvedValue({ total: 0, entries: [] }),
    });

    const result = await enrichRequestDetail(client, { requestId: "req-1" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("req-1");
    expect(result!.queries).toHaveLength(1);
  });

  it("returns null when no params provided", async () => {
    const client = makeMockClient();
    const result = await enrichRequestDetail(client, {});
    expect(result).toBeNull();
  });
});
