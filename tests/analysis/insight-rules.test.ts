import { describe, it, expect } from "vitest";
import { InsightRunner } from "../../src/analysis/insights/runner.js";
import { n1Rule } from "../../src/analysis/insights/rules/n1.js";
import { duplicateRule } from "../../src/analysis/insights/rules/duplicate.js";
import { slowRule } from "../../src/analysis/insights/rules/slow.js";
import { errorRule } from "../../src/analysis/insights/rules/error.js";
import { errorHotspotRule } from "../../src/analysis/insights/rules/error-hotspot.js";
import { crossEndpointRule } from "../../src/analysis/insights/rules/cross-endpoint.js";
import { redundantQueryRule } from "../../src/analysis/insights/rules/redundant-query.js";
import { queryHeavyRule } from "../../src/analysis/insights/rules/query-heavy.js";
import { selectStarRule } from "../../src/analysis/insights/rules/select-star.js";
import { highRowsRule } from "../../src/analysis/insights/rules/high-rows.js";
import { largeResponseRule } from "../../src/analysis/insights/rules/large-response.js";
import { responseOverfetchRule } from "../../src/analysis/insights/rules/response-overfetch.js";
import { regressionRule } from "../../src/analysis/insights/rules/regression.js";
import { securityRule } from "../../src/analysis/insights/rules/security.js";
import type { RequestFlow, LabeledRequest } from "../../src/types/analysis.js";
import type { TracedQuery } from "../../src/types/telemetry.js";
import type { SecurityFinding } from "../../src/types/security.js";
import type { EndpointMetrics } from "../../src/types/metrics.js";
import { makeRequest, makeQuery, makeError, makeInsightContext as makeCtx } from "../helpers/index.js";

describe("n1Rule", () => {
  it("detects N+1 query pattern when many similar queries run in one request", () => {
    const runner = new InsightRunner();
    runner.register(n1Rule);

    const req = makeRequest({ id: "req-1" });
    const queries: TracedQuery[] = [];
    for (let i = 1; i <= 7; i++) {
      queries.push(
        makeQuery({
          id: `q-${i}`,
          parentRequestId: "req-1",
          sql: `SELECT * FROM posts WHERE user_id = ${i}`,
        }),
      );
    }

    const ctx = makeCtx({
      requests: [req],
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
      makeQuery({ id: "q-1", parentRequestId: "req-1", sql: "SELECT * FROM posts WHERE user_id = 1" }),
      makeQuery({ id: "q-2", parentRequestId: "req-1", sql: "SELECT * FROM posts WHERE user_id = 2" }),
    ];

    const ctx = makeCtx({
      requests: [makeRequest({ id: "req-1" })],
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
        makeRequest({ id: "req-1", url: "/api/posts", path: "/api/posts", durationMs: 1500, responseSize: 200 }),
        makeRequest({ id: "req-2", url: "/api/posts", path: "/api/posts", durationMs: 2000, responseSize: 200 }),
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

describe("errorRule", () => {
  it("detects unhandled errors grouped by name", () => {
    const runner = new InsightRunner();
    runner.register(errorRule);

    const ctx = makeCtx({
      errors: [
        makeError({ name: "TypeError", message: "Cannot read property" }),
        makeError({ name: "TypeError", message: "x is not a function" }),
        makeError({ name: "ReferenceError", message: "y is not defined" }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(2);
    expect(insights[0].type).toBe("error");
    expect(insights[0].severity).toBe("critical");
    const typeErrorInsight = insights.find((i) => i.desc.includes("TypeError"));
    expect(typeErrorInsight?.desc).toContain("2 times");
  });

  it("does not trigger with no errors", () => {
    const runner = new InsightRunner();
    runner.register(errorRule);

    const ctx = makeCtx({ errors: [] });
    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("errorHotspotRule", () => {
  it("detects endpoints with high error rate", () => {
    const runner = new InsightRunner();
    runner.register(errorHotspotRule);

    // 2 requests to same endpoint, 1 fails = 50% error rate (threshold is 20%)
    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "r1", path: "/api/payments", url: "/api/payments", statusCode: 500 }),
        makeRequest({ id: "r2", path: "/api/payments", url: "/api/payments", statusCode: 200 }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("error-hotspot");
    expect(insights[0].severity).toBe("critical");
    expect(insights[0].desc).toContain("50%");
  });

  it("does not trigger below error rate threshold", () => {
    const runner = new InsightRunner();
    runner.register(errorHotspotRule);

    // 10 requests, 1 error = 10% (below 20% threshold)
    const requests = Array.from({ length: 10 }, (_, i) =>
      makeRequest({
        id: `r${i}`,
        path: "/api/users",
        url: "/api/users",
        statusCode: i === 0 ? 500 : 200,
      }),
    );

    const ctx = makeCtx({ requests });
    expect(runner.run(ctx)).toHaveLength(0);
  });

  it("does not trigger with only 1 request (below min requests)", () => {
    const runner = new InsightRunner();
    runner.register(errorHotspotRule);

    const ctx = makeCtx({
      requests: [makeRequest({ statusCode: 500 })],
    });

    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("crossEndpointRule", () => {
  it("detects a query that runs across many endpoints", () => {
    const runner = new InsightRunner();
    runner.register(crossEndpointRule);

    // Need >= 3 endpoints, query on >= 3 of them (50%), >= 5 total occurrences
    const endpoints = [
      { path: "/api/users", method: "GET" },
      { path: "/api/posts", method: "GET" },
      { path: "/api/comments", method: "GET" },
    ];

    const requests = endpoints.map((ep, i) =>
      makeRequest({ id: `r${i}`, path: ep.path, url: ep.path, method: ep.method }),
    );

    // Same query shape on all 3 endpoints, 2 per endpoint = 6 total
    const queries = endpoints.flatMap((_, i) => [
      makeQuery({ id: `q${i}a`, parentRequestId: `r${i}`, sql: "SELECT * FROM settings WHERE key = $1", table: "settings" }),
      makeQuery({ id: `q${i}b`, parentRequestId: `r${i}`, sql: "SELECT * FROM settings WHERE key = $2", table: "settings" }),
    ]);

    const ctx = makeCtx({ requests, queries });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("cross-endpoint");
    expect(insights[0].severity).toBe("warning");
  });

  it("does not trigger when query appears on fewer than 3 endpoints", () => {
    const runner = new InsightRunner();
    runner.register(crossEndpointRule);

    const requests = [
      makeRequest({ id: "r1", path: "/api/users", url: "/api/users" }),
      makeRequest({ id: "r2", path: "/api/posts", url: "/api/posts" }),
    ];

    const queries = [
      makeQuery({ id: "q1", parentRequestId: "r1", sql: "SELECT * FROM settings WHERE key = $1", table: "settings" }),
      makeQuery({ id: "q2", parentRequestId: "r2", sql: "SELECT * FROM settings WHERE key = $2", table: "settings" }),
    ];

    const ctx = makeCtx({ requests, queries });
    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("redundantQueryRule", () => {
  it("detects identical SQL running multiple times in one request", () => {
    const runner = new InsightRunner();
    runner.register(redundantQueryRule);

    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1" })],
      queries: [
        makeQuery({ id: "q1", parentRequestId: "r1", sql: "SELECT * FROM users WHERE id = 1" }),
        makeQuery({ id: "q2", parentRequestId: "r1", sql: "SELECT * FROM users WHERE id = 1" }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("redundant-query");
    expect(insights[0].severity).toBe("warning");
    expect(insights[0].desc).toContain("2x");
  });

  it("does not trigger for different SQL in the same request", () => {
    const runner = new InsightRunner();
    runner.register(redundantQueryRule);

    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1" })],
      queries: [
        makeQuery({ id: "q1", parentRequestId: "r1", sql: "SELECT * FROM users WHERE id = 1" }),
        makeQuery({ id: "q2", parentRequestId: "r1", sql: "SELECT * FROM users WHERE id = 2" }),
      ],
    });

    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("queryHeavyRule", () => {
  it("detects endpoints with too many queries per request", () => {
    const runner = new InsightRunner();
    runner.register(queryHeavyRule);

    // 2 requests to same endpoint, each with 8 queries = avg 8 (threshold is > 5)
    const requests = [
      makeRequest({ id: "r1", path: "/api/dashboard", url: "/api/dashboard" }),
      makeRequest({ id: "r2", path: "/api/dashboard", url: "/api/dashboard" }),
    ];

    const queries = [];
    for (let r = 1; r <= 2; r++) {
      for (let q = 1; q <= 8; q++) {
        queries.push(makeQuery({
          id: `q-r${r}-${q}`,
          parentRequestId: `r${r}`,
          sql: `SELECT * FROM table_${q} WHERE id = $1`,
          table: `table_${q}`,
        }));
      }
    }

    const ctx = makeCtx({ requests, queries });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("query-heavy");
    expect(insights[0].desc).toContain("avg 8 queries/request");
  });

  it("does not trigger when avg queries per request is within threshold", () => {
    const runner = new InsightRunner();
    runner.register(queryHeavyRule);

    const requests = [
      makeRequest({ id: "r1", path: "/api/users", url: "/api/users" }),
      makeRequest({ id: "r2", path: "/api/users", url: "/api/users" }),
    ];

    const queries = [
      makeQuery({ id: "q1", parentRequestId: "r1" }),
      makeQuery({ id: "q2", parentRequestId: "r2" }),
    ];

    const ctx = makeCtx({ requests, queries });
    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("selectStarRule", () => {
  it("detects SELECT * queries appearing multiple times", () => {
    const runner = new InsightRunner();
    runner.register(selectStarRule);

    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "r1" }),
        makeRequest({ id: "r2" }),
      ],
      queries: [
        makeQuery({ id: "q1", parentRequestId: "r1", sql: "SELECT * FROM public.users WHERE active = true", table: "users" }),
        makeQuery({ id: "q2", parentRequestId: "r2", sql: "SELECT * FROM public.users WHERE id = 5", table: "users" }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("select-star");
    expect(insights[0].desc).toContain("users");
    expect(insights[0].desc).toContain("2 occurrence");
  });

  it("does not trigger for explicit column queries", () => {
    const runner = new InsightRunner();
    runner.register(selectStarRule);

    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1" })],
      queries: [
        makeQuery({ id: "q1", parentRequestId: "r1", sql: "SELECT id, name FROM users WHERE id = $1", table: "users" }),
        makeQuery({ id: "q2", parentRequestId: "r1", sql: "SELECT email FROM users WHERE id = $1", table: "users" }),
      ],
    });

    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("highRowsRule", () => {
  it("detects queries returning large result sets", () => {
    const runner = new InsightRunner();
    runner.register(highRowsRule);

    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "r1" }),
        makeRequest({ id: "r2" }),
      ],
      queries: [
        makeQuery({ id: "q1", parentRequestId: "r1", sql: "SELECT * FROM logs", table: "logs", rowCount: 500 }),
        makeQuery({ id: "q2", parentRequestId: "r2", sql: "SELECT * FROM logs", table: "logs", rowCount: 300 }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("high-rows");
    expect(insights[0].desc).toContain("500+ rows");
  });

  it("does not trigger for small result sets", () => {
    const runner = new InsightRunner();
    runner.register(highRowsRule);

    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1" })],
      queries: [
        makeQuery({ id: "q1", parentRequestId: "r1", rowCount: 10 }),
        makeQuery({ id: "q2", parentRequestId: "r1", rowCount: 50 }),
      ],
    });

    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("largeResponseRule", () => {
  it("detects endpoints with large average response size", () => {
    const runner = new InsightRunner();
    runner.register(largeResponseRule);

    // avg > 51200 bytes with >= 2 requests
    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "r1", path: "/api/export", url: "/api/export", responseSize: 60000 }),
        makeRequest({ id: "r2", path: "/api/export", url: "/api/export", responseSize: 70000 }),
      ],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("large-response");
    expect(insights[0].severity).toBe("info");
    expect(insights[0].desc).toContain("GET /api/export");
  });

  it("does not trigger for small responses", () => {
    const runner = new InsightRunner();
    runner.register(largeResponseRule);

    const ctx = makeCtx({
      requests: [
        makeRequest({ id: "r1", path: "/api/data", url: "/api/data", responseSize: 1000 }),
        makeRequest({ id: "r2", path: "/api/data", url: "/api/data", responseSize: 2000 }),
      ],
    });

    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("responseOverfetchRule", () => {
  it("detects responses with many internal ID fields", () => {
    const runner = new InsightRunner();
    runner.register(responseOverfetchRule);

    const body = JSON.stringify({
      id: 1,
      name: "Alice",
      email: "alice@example.com",
      userId: "u-1",
      orgId: "org-1",
      teamId: "team-1",
      status: "active",
      role: "admin",
    });

    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1", responseBody: body })],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("response-overfetch");
    expect(insights[0].severity).toBe("info");
  });

  it("detects responses with high null ratio", () => {
    const runner = new InsightRunner();
    runner.register(responseOverfetchRule);

    const body = JSON.stringify({
      name: "Alice",
      email: "alice@example.com",
      avatar: null,
      bio: null,
      phone: null,
      address: null,
      company: null,
      website: "example.com",
    });

    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1", responseBody: body })],
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("response-overfetch");
    expect(insights[0].desc).toContain("null");
  });

  it("does not trigger for small responses with few fields", () => {
    const runner = new InsightRunner();
    runner.register(responseOverfetchRule);

    const body = JSON.stringify({ name: "Alice", status: "ok" });
    const ctx = makeCtx({
      requests: [makeRequest({ id: "r1", responseBody: body })],
    });

    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("regressionRule", () => {
  it("detects p95 performance regression between sessions", () => {
    const runner = new InsightRunner();
    runner.register(regressionRule);

    const previousMetrics: EndpointMetrics[] = [
      {
        endpoint: "GET /api/users",
        sessions: [
          { sessionId: "s1", startedAt: 1000, avgDurationMs: 150, p95DurationMs: 200, requestCount: 10, errorCount: 0, avgQueryCount: 3, avgQueryTimeMs: 20, avgFetchTimeMs: 0 },
          { sessionId: "s2", startedAt: 2000, avgDurationMs: 400, p95DurationMs: 500, requestCount: 10, errorCount: 0, avgQueryCount: 3, avgQueryTimeMs: 20, avgFetchTimeMs: 0 },
        ],
      },
    ];

    const ctx = makeCtx({ previousMetrics });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("regression");
    expect(insights[0].severity).toBe("warning");
    expect(insights[0].desc).toContain("GET /api/users");
    expect(insights[0].desc).toContain("+150%");
  });

  it("detects query count regression", () => {
    const runner = new InsightRunner();
    runner.register(regressionRule);

    const previousMetrics: EndpointMetrics[] = [
      {
        endpoint: "GET /api/posts",
        sessions: [
          { sessionId: "s1", startedAt: 1000, avgDurationMs: 80, p95DurationMs: 100, requestCount: 10, errorCount: 0, avgQueryCount: 2, avgQueryTimeMs: 10, avgFetchTimeMs: 0 },
          { sessionId: "s2", startedAt: 2000, avgDurationMs: 80, p95DurationMs: 100, requestCount: 10, errorCount: 0, avgQueryCount: 4, avgQueryTimeMs: 10, avgFetchTimeMs: 0 },
        ],
      },
    ];

    const ctx = makeCtx({ previousMetrics });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].desc).toContain("queries/request increased");
  });

  it("does not trigger without previous metrics", () => {
    const runner = new InsightRunner();
    runner.register(regressionRule);

    const ctx = makeCtx({});
    expect(runner.run(ctx)).toHaveLength(0);
  });

  it("does not trigger with only one session", () => {
    const runner = new InsightRunner();
    runner.register(regressionRule);

    const previousMetrics: EndpointMetrics[] = [
      {
        endpoint: "GET /api/users",
        sessions: [
          { sessionId: "s1", startedAt: 1000, avgDurationMs: 400, p95DurationMs: 500, requestCount: 10, errorCount: 0, avgQueryCount: 3, avgQueryTimeMs: 20, avgFetchTimeMs: 0 },
        ],
      },
    ];

    const ctx = makeCtx({ previousMetrics });
    expect(runner.run(ctx)).toHaveLength(0);
  });
});

describe("securityRule", () => {
  it("converts security findings to insights", () => {
    const runner = new InsightRunner();
    runner.register(securityRule);

    const finding: SecurityFinding = {
      severity: "critical",
      rule: "exposed-secret",
      title: "Exposed Secret",
      desc: "GET /api/users — apiKey found in response",
      hint: "Remove secrets from API responses.",
      endpoint: "GET /api/users",
      count: 1,
    };

    const ctx = makeCtx({ securityFindings: [finding] });
    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("security");
    expect(insights[0].severity).toBe("critical");
    expect(insights[0].title).toBe("Exposed Secret");
  });

  it("returns empty when no security findings", () => {
    const runner = new InsightRunner();
    runner.register(securityRule);

    const ctx = makeCtx({ securityFindings: [] });
    expect(runner.run(ctx)).toHaveLength(0);
  });

  it("returns empty when securityFindings is undefined", () => {
    const runner = new InsightRunner();
    runner.register(securityRule);

    const ctx = makeCtx({});
    expect(runner.run(ctx)).toHaveLength(0);
  });
});
