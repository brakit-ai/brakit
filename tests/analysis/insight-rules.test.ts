import { describe, it, expect } from "vitest";
import { InsightRunner } from "../../src/analysis/insights/runner.js";
import { n1Rule } from "../../src/analysis/insights/rules/n1.js";
import { duplicateRule } from "../../src/analysis/insights/rules/duplicate.js";
import { slowRule } from "../../src/analysis/insights/rules/slow.js";
import type { InsightContext } from "../../src/analysis/insights/types.js";
import type { TracedRequest } from "../../src/types/http.js";
import type { TracedQuery } from "../../src/types/telemetry.js";
import type { RequestFlow, LabeledRequest } from "../../src/types/analysis.js";

function makeRequest(overrides: Partial<TracedRequest> = {}): TracedRequest {
  return {
    id: "req-1",
    method: "GET",
    url: "/api/posts",
    path: "/api/posts",
    headers: {},
    requestBody: null,
    statusCode: 200,
    responseHeaders: {},
    responseBody: null,
    startedAt: Date.now(),
    durationMs: 50,
    responseSize: 100,
    isStatic: false,
    ...overrides,
  };
}

function makeQuery(overrides: Partial<TracedQuery> = {}): TracedQuery {
  return {
    id: "q-1",
    parentRequestId: "req-1",
    timestamp: Date.now(),
    driver: "pg",
    sql: "SELECT * FROM users WHERE id = $1",
    durationMs: 10,
    normalizedOp: "SELECT",
    table: "users",
    ...overrides,
  };
}

function makeCtx(overrides: Partial<InsightContext> = {}): InsightContext {
  return {
    requests: [],
    queries: [],
    errors: [],
    flows: [],
    fetches: [],
    ...overrides,
  };
}

describe("n1Rule", () => {
  it("detects N+1 query pattern when many similar queries run in one request", () => {
    const runner = new InsightRunner();
    runner.register(n1Rule);

    const queries: TracedQuery[] = [];
    for (let i = 1; i <= 7; i++) {
      queries.push(
        makeQuery({
          id: `q-${i}`,
          sql: `SELECT * FROM posts WHERE user_id = ${i}`,
        }),
      );
    }

    const ctx = makeCtx({
      requests: [makeRequest()],
      queries,
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("n1");
    expect(insights[0].severity).toBe("critical");
    expect(insights[0].desc).toContain("7x");
  });

  it("does not trigger below the N+1 threshold", () => {
    const runner = new InsightRunner();
    runner.register(n1Rule);

    const queries = [
      makeQuery({ id: "q-1", sql: "SELECT * FROM posts WHERE user_id = 1" }),
      makeQuery({ id: "q-2", sql: "SELECT * FROM posts WHERE user_id = 2" }),
    ];

    const ctx = makeCtx({
      requests: [makeRequest()],
      queries,
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(0);
  });
});

describe("duplicateRule", () => {
  it("detects duplicate API calls within a flow", () => {
    const runner = new InsightRunner();
    runner.register(duplicateRule);

    const dupRequest = {
      ...makeRequest({ id: "fr-1", path: "/api/users" }),
      label: "GET /api/users",
      category: "data-fetch" as const,
      isDuplicate: true,
    } satisfies LabeledRequest;

    const flow: RequestFlow = {
      id: "flow-1",
      label: "Loaded dashboard",
      requests: [
        dupRequest,
        { ...dupRequest, id: "fr-2" },
        { ...dupRequest, id: "fr-3" },
      ],
      startTime: Date.now(),
      totalDurationMs: 200,
      hasErrors: false,
      warnings: [],
      sourcePage: "/dashboard",
      redundancyPct: 66,
    };

    const ctx = makeCtx({ flows: [flow] });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("duplicate");
    expect(insights[0].severity).toBe("warning");
    expect(insights[0].desc).toContain("3x");
  });

  it("does not trigger when no duplicates exist", () => {
    const runner = new InsightRunner();
    runner.register(duplicateRule);

    const flow: RequestFlow = {
      id: "flow-1",
      label: "Loaded dashboard",
      requests: [
        {
          ...makeRequest({ id: "fr-1" }),
          label: "GET /api/users",
          category: "data-fetch" as const,
        },
      ],
      startTime: Date.now(),
      totalDurationMs: 100,
      hasErrors: false,
      warnings: [],
      sourcePage: "/dashboard",
      redundancyPct: 0,
    };

    const ctx = makeCtx({ flows: [flow] });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(0);
  });
});

describe("slowRule", () => {
  it("detects slow endpoints exceeding threshold", () => {
    const runner = new InsightRunner();
    runner.register(slowRule);

    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "req-1", durationMs: 1500, responseSize: 200 }),
        makeRequest({ id: "req-2", durationMs: 2000, responseSize: 200 }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("slow");
    expect(insights[0].severity).toBe("warning");
    expect(insights[0].desc).toContain("GET /api/posts");
  });

  it("does not trigger for fast endpoints", () => {
    const runner = new InsightRunner();
    runner.register(slowRule);

    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "req-1", durationMs: 50, responseSize: 100 }),
        makeRequest({ id: "req-2", durationMs: 80, responseSize: 100 }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(0);
  });

  it("does not trigger for a single request (below min requests)", () => {
    const runner = new InsightRunner();
    runner.register(slowRule);

    const ctx = makeCtx({
      requests: [makeRequest({ durationMs: 5000, responseSize: 200 })],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(0);
  });
});
