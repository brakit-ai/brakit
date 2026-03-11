import { describe, it, expect, vi } from "vitest";
import { enrichFindings, enrichEndpoints, enrichRequestDetail } from "../../src/mcp/enrichment.js";
import { makeStatefulIssue, makeMockClient } from "../helpers/mcp-factories.js";
import { makeRequest, makeQuery } from "../helpers/factories.js";

describe("enrichFindings", () => {
  it("returns empty array when no issues exist", async () => {
    const client = makeMockClient();
    const result = await enrichFindings(client);
    expect(result).toHaveLength(0);
  });

  it("maps issues to enriched format", async () => {
    const issue = makeStatefulIssue({
      issue: {
        category: "security",
        rule: "sql-injection",
        severity: "warning",
        title: "SQL Injection",
        desc: "User input in query",
        hint: "Use parameterized queries",
        endpoint: "GET /api/test",
      },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [issue] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("SQL Injection");
    expect(result[0].description).toBe("User input in query");
    expect(result[0].severity).toBe("warning");
  });

  it("includes issueId on enriched findings", async () => {
    const stateful = makeStatefulIssue();
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [stateful] }),
    });

    const result = await enrichFindings(client);
    expect(result[0].findingId).toMatch(/^[0-9a-f]{16}$/);
  });

  it("includes critical/warning issues", async () => {
    const issue = makeStatefulIssue({
      issue: {
        category: "performance",
        rule: "slow",
        severity: "critical",
        title: "Slow Endpoint",
        desc: "GET /api/slow — avg 5.0s",
        hint: "Optimize queries",
        endpoint: "GET /api/slow",
      },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [issue] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("critical");
  });

  it("excludes info severity issues", async () => {
    const issue = makeStatefulIssue({
      issue: {
        category: "performance",
        rule: "info-rule",
        severity: "info",
        title: "Info Issue",
        desc: "Something informational",
        hint: "No action needed",
      },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [issue] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(0);
  });

  it("excludes resolved and stale issues", async () => {
    const resolved = makeStatefulIssue({ state: "resolved" });
    const stale = makeStatefulIssue({
      state: "stale",
      issue: { ...resolved.issue, rule: "other-rule" },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [resolved, stale] }),
    });

    const result = await enrichFindings(client);
    expect(result).toHaveLength(0);
  });

  it("attaches context from request activity data", async () => {
    const issue = makeStatefulIssue({
      issue: {
        category: "security",
        rule: "test-rule",
        severity: "warning",
        title: "Test",
        desc: "test",
        hint: "fix",
        endpoint: "GET /api/users",
      },
    });
    const req = makeRequest({ id: "req-1", durationMs: 120 });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [issue] }),
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
    const issue = makeStatefulIssue();
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [issue] }),
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
