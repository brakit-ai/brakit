import { describe, it, expect, vi } from "vitest";
import type { BrakitClient } from "../../src/mcp/client.js";
import { getFindings } from "../../src/mcp/tools/get-findings.js";
import { getEndpoints } from "../../src/mcp/tools/get-endpoints.js";
import { getRequestDetail } from "../../src/mcp/tools/get-request-detail.js";
import { verifyFix } from "../../src/mcp/tools/verify-fix.js";
import { getReport } from "../../src/mcp/tools/get-report.js";
import { clearFindings } from "../../src/mcp/tools/clear-findings.js";
import { makeSecurityFinding, makeStatefulFinding } from "../helpers/mcp-factories.js";
import { makeRequest, makeQuery, makeFetch } from "../helpers/factories.js";

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

describe("get_findings", () => {
  it("returns healthy message when no findings", async () => {
    const client = makeMockClient();
    const result = await getFindings.handler(client, {});
    expect(result.content[0].text).toContain("healthy");
  });

  it("formats findings with severity and endpoint", async () => {
    const finding = makeSecurityFinding({ severity: "critical", title: "SQL Injection", endpoint: "POST /api/login" });
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [finding] }),
    });

    const result = await getFindings.handler(client, {});
    expect(result.content[0].text).toContain("[CRITICAL]");
    expect(result.content[0].text).toContain("SQL Injection");
    expect(result.content[0].text).toContain("POST /api/login");
  });

  it("filters by severity", async () => {
    const critical = makeSecurityFinding({ severity: "critical", rule: "r1" });
    const warning = makeSecurityFinding({ severity: "warning", rule: "r2" });
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [critical, warning] }),
    });

    const result = await getFindings.handler(client, { severity: "critical" });
    expect(result.content[0].text).toContain("[CRITICAL]");
    expect(result.content[0].text).not.toContain("[WARNING]");
  });

  it("filters by state using findingId matching", async () => {
    const finding = makeSecurityFinding();
    const stateful = makeStatefulFinding({ finding, state: "open" });
    const client = makeMockClient({
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [finding] }),
      getFindings: vi.fn().mockResolvedValue({ total: 1, findings: [stateful] }),
    });

    const result = await getFindings.handler(client, { state: "open" });
    expect(result.content[0].text).toContain("1 issue(s)");
  });

  it("rejects invalid severity", async () => {
    const client = makeMockClient();
    const result = await getFindings.handler(client, { severity: "invalid" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid severity");
  });

  it("rejects invalid state", async () => {
    const client = makeMockClient();
    const result = await getFindings.handler(client, { state: "invalid" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid state");
  });
});

describe("get_endpoints", () => {
  it("returns message when no endpoints", async () => {
    const client = makeMockClient();
    const result = await getEndpoints.handler(client, {});
    expect(result.content[0].text).toContain("No endpoints");
  });

  it("formats endpoint summary", async () => {
    const client = makeMockClient({
      getLiveMetrics: vi.fn().mockResolvedValue({
        endpoints: [{
          endpoint: "GET /api/users",
          summary: { p95Ms: 150, errorRate: 0.02, avgQueryCount: 3, totalRequests: 50, avgQueryTimeMs: 10, avgFetchTimeMs: 5, avgAppTimeMs: 135 },
        }],
      }),
    });

    const result = await getEndpoints.handler(client, {});
    expect(result.content[0].text).toContain("GET /api/users");
    expect(result.content[0].text).toContain("150ms");
  });

  it("rejects invalid sort_by", async () => {
    const client = makeMockClient();
    const result = await getEndpoints.handler(client, { sort_by: "invalid" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid sort_by");
  });
});

describe("get_request_detail", () => {
  it("requires at least one param", async () => {
    const client = makeMockClient();
    const result = await getRequestDetail.handler(client, {});
    expect(result.content[0].text).toContain("provide either");
  });

  it("returns not found for missing request", async () => {
    const client = makeMockClient();
    const result = await getRequestDetail.handler(client, { request_id: "nonexistent" });
    expect(result.content[0].text).toContain("No request found");
  });

  it("returns detail for valid request", async () => {
    const req = makeRequest({ id: "req-1", method: "GET", url: "/api/users", statusCode: 200, durationMs: 50 });
    const query = makeQuery({ parentRequestId: "req-1", sql: "SELECT * FROM users", durationMs: 10 });
    const client = makeMockClient({
      getRequests: vi.fn().mockResolvedValue({ total: 1, requests: [req] }),
      getActivity: vi.fn().mockResolvedValue({
        requestId: "req-1", total: 0, timeline: [],
        counts: { fetches: 0, logs: 0, errors: 0, queries: 1 },
      }),
      getQueries: vi.fn().mockResolvedValue({ total: 1, entries: [query] }),
      getFetches: vi.fn().mockResolvedValue({ total: 0, entries: [] }),
    });

    const result = await getRequestDetail.handler(client, { request_id: "req-1" });
    expect(result.content[0].text).toContain("GET /api/users");
    expect(result.content[0].text).toContain("50ms");
    expect(result.content[0].text).toContain("SELECT * FROM users");
  });
});

describe("verify_fix", () => {
  it("reports resolved finding", async () => {
    const finding = makeSecurityFinding({ title: "SQL Injection" });
    const stateful = makeStatefulFinding({ finding, state: "resolved" });
    const client = makeMockClient({
      getFindings: vi.fn().mockResolvedValue({ total: 1, findings: [stateful] }),
    });

    const result = await verifyFix.handler(client, { finding_id: stateful.findingId });
    expect(result.content[0].text).toContain("RESOLVED");
  });

  it("reports still-present finding", async () => {
    const finding = makeSecurityFinding({ title: "SQL Injection" });
    const stateful = makeStatefulFinding({ finding, state: "open" });
    const client = makeMockClient({
      getFindings: vi.fn().mockResolvedValue({ total: 1, findings: [stateful] }),
    });

    const result = await verifyFix.handler(client, { finding_id: stateful.findingId });
    expect(result.content[0].text).toContain("STILL PRESENT");
  });

  it("reports not found for unknown ID", async () => {
    const client = makeMockClient({
      getFindings: vi.fn().mockResolvedValue({ total: 0, findings: [] }),
    });

    const result = await verifyFix.handler(client, { finding_id: "nonexistent" });
    expect(result.content[0].text).toContain("not found");
  });

  it("requires at least one param", async () => {
    const client = makeMockClient();
    const result = await verifyFix.handler(client, {});
    expect(result.content[0].text).toContain("provide either");
  });

  it("rejects empty finding_id", async () => {
    const client = makeMockClient();
    const result = await verifyFix.handler(client, { finding_id: "  " });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("cannot be empty");
  });

  it("rejects empty endpoint", async () => {
    const client = makeMockClient();
    const result = await verifyFix.handler(client, { endpoint: "" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("cannot be empty");
  });
});

describe("get_report", () => {
  it("returns report with finding counts", async () => {
    const openFinding = makeStatefulFinding({ state: "open" });
    const resolvedFinding = makeStatefulFinding({
      state: "resolved",
      finding: makeSecurityFinding({ rule: "other-rule" }),
    });
    const client = makeMockClient({
      getFindings: vi.fn().mockResolvedValue({ total: 2, findings: [openFinding, resolvedFinding] }),
      getSecurityFindings: vi.fn().mockResolvedValue({ findings: [makeSecurityFinding()] }),
      getInsights: vi.fn().mockResolvedValue({ insights: [] }),
      getLiveMetrics: vi.fn().mockResolvedValue({
        endpoints: [{
          endpoint: "GET /api/test",
          summary: { totalRequests: 10 },
        }],
      }),
    });

    const result = await getReport.handler(client, {});
    expect(result.content[0].text).toContain("Total: 2");
    expect(result.content[0].text).toContain("Open: 1");
    expect(result.content[0].text).toContain("Resolved: 1");
  });
});

describe("clear_findings", () => {
  it("returns success message on ok", async () => {
    const client = makeMockClient({ clearAll: vi.fn().mockResolvedValue(true) });
    const result = await clearFindings.handler(client, {});
    expect(result.content[0].text).toContain("cleared");
  });

  it("returns failure message on error", async () => {
    const client = makeMockClient({ clearAll: vi.fn().mockResolvedValue(false) });
    const result = await clearFindings.handler(client, {});
    expect(result.content[0].text).toContain("Failed");
  });
});
