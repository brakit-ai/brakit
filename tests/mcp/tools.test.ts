import { describe, it, expect, vi } from "vitest";
import { getFindings } from "../../src/mcp/tools/get-findings.js";
import { getEndpoints } from "../../src/mcp/tools/get-endpoints.js";
import { getRequestDetail } from "../../src/mcp/tools/get-request-detail.js";
import { verifyFix } from "../../src/mcp/tools/verify-fix.js";
import { getReport } from "../../src/mcp/tools/get-report.js";
import { clearFindings } from "../../src/mcp/tools/clear-findings.js";
import { reportFix } from "../../src/mcp/tools/report-fix.js";
import { makeStatefulIssue, makeMockClient } from "../helpers/mcp-factories.js";
import { makeRequest, makeQuery } from "../helpers/factories.js";

describe("get_findings", () => {
  it("returns healthy message when no findings", async () => {
    const client = makeMockClient();
    const result = await getFindings.handler(client, {});
    expect(result.content[0].text).toContain("healthy");
  });

  it("formats findings with severity and endpoint", async () => {
    const stateful = makeStatefulIssue({
      issue: {
        category: "security",
        rule: "sql-injection",
        severity: "critical",
        title: "SQL Injection",
        desc: "User input in query",
        hint: "Use parameterized queries",
        endpoint: "POST /api/login",
      },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [stateful] }),
    });

    const result = await getFindings.handler(client, {});
    expect(result.content[0].text).toContain("[CRITICAL]");
    expect(result.content[0].text).toContain("SQL Injection");
    expect(result.content[0].text).toContain("POST /api/login");
  });

  it("filters by severity", async () => {
    const criticalIssue = makeStatefulIssue({
      issue: {
        category: "security",
        rule: "r1",
        severity: "critical",
        title: "Critical Issue",
        desc: "critical desc",
        hint: "fix",
        endpoint: "GET /api/a",
      },
    });
    const warningIssue = makeStatefulIssue({
      issue: {
        category: "security",
        rule: "r2",
        severity: "warning",
        title: "Warning Issue",
        desc: "warning desc",
        hint: "fix",
        endpoint: "GET /api/b",
      },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [criticalIssue, warningIssue] }),
    });

    const result = await getFindings.handler(client, { severity: "critical" });
    expect(result.content[0].text).toContain("[CRITICAL]");
    expect(result.content[0].text).not.toContain("[WARNING]");
  });

  it("filters by state using issueId matching", async () => {
    const stateful = makeStatefulIssue({ state: "open" });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [stateful] }),
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
    const stateful = makeStatefulIssue({
      state: "resolved",
      issue: {
        category: "security",
        rule: "sql-injection",
        severity: "warning",
        title: "SQL Injection",
        desc: "test",
        hint: "fix",
        endpoint: "GET /api/test",
      },
    });
    const client = makeMockClient({
      getFindings: vi.fn().mockResolvedValue({ total: 1, findings: [stateful] }),
    });

    const result = await verifyFix.handler(client, { finding_id: stateful.issueId });
    expect(result.content[0].text).toContain("RESOLVED");
  });

  it("reports still-present finding", async () => {
    const stateful = makeStatefulIssue({
      state: "open",
      issue: {
        category: "security",
        rule: "sql-injection",
        severity: "warning",
        title: "SQL Injection",
        desc: "test",
        hint: "fix",
        endpoint: "GET /api/test",
      },
    });
    const client = makeMockClient({
      getFindings: vi.fn().mockResolvedValue({ total: 1, findings: [stateful] }),
    });

    const result = await verifyFix.handler(client, { finding_id: stateful.issueId });
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
  it("returns report with issue counts", async () => {
    const openIssue = makeStatefulIssue({ state: "open" });
    const resolvedIssue = makeStatefulIssue({
      state: "resolved",
      issue: {
        category: "security",
        rule: "other-rule",
        severity: "warning",
        title: "Other Issue",
        desc: "other desc",
        hint: "fix",
        endpoint: "GET /api/other",
      },
    });
    const client = makeMockClient({
      getIssues: vi.fn().mockResolvedValue({ issues: [openIssue, resolvedIssue] }),
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

describe("report_fix", () => {
  it("requires finding_id", async () => {
    const client = makeMockClient();
    const result = await reportFix.handler(client, { status: "fixed", summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("finding_id is required");
  });

  it("rejects empty finding_id", async () => {
    const client = makeMockClient();
    const result = await reportFix.handler(client, { finding_id: "  ", status: "fixed", summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("finding_id is required");
  });

  it("rejects invalid status", async () => {
    const client = makeMockClient();
    const result = await reportFix.handler(client, { finding_id: "abc", status: "invalid", summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("status must be");
  });

  it("requires summary", async () => {
    const client = makeMockClient();
    const result = await reportFix.handler(client, { finding_id: "abc", status: "fixed", summary: "" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("summary is required");
  });

  it("returns error when finding not found", async () => {
    const client = makeMockClient({ reportFix: vi.fn().mockResolvedValue(false) });
    const result = await reportFix.handler(client, { finding_id: "abc", status: "fixed", summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("confirms fixed status", async () => {
    const client = makeMockClient({ reportFix: vi.fn().mockResolvedValue(true) });
    const result = await reportFix.handler(client, { finding_id: "abc", status: "fixed", summary: "wrapped in useCallback" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("marked as fixed");
  });

  it("confirms wont_fix status", async () => {
    const client = makeMockClient({ reportFix: vi.fn().mockResolvedValue(true) });
    const result = await reportFix.handler(client, { finding_id: "abc", status: "wont_fix", summary: "third-party lib" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("won't fix");
  });
});
