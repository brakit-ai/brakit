import { describe, it, expect, beforeEach } from "vitest";
import { QueryStore } from "../../src/store/query-store.js";
import { FetchStore } from "../../src/store/fetch-store.js";
import { LogStore } from "../../src/store/log-store.js";
import { ErrorStore } from "../../src/store/error-store.js";
import { InsightRunner } from "../../src/analysis/insights/runner.js";
import { n1Rule } from "../../src/analysis/insights/rules/n1.js";
import { errorRule } from "../../src/analysis/insights/rules/error.js";
import { redundantQueryRule } from "../../src/analysis/insights/rules/redundant-query.js";
import { SecurityScanner } from "../../src/analysis/rules/scanner.js";
import { exposedSecretRule } from "../../src/analysis/rules/exposed-secret.js";
import { tokenInUrlRule } from "../../src/analysis/rules/token-in-url.js";
import type { TelemetryEvent } from "../../src/types/index.js";
import { makeRequest, makeQuery, makeError, makeFetch, makeInsightContext } from "../helpers/index.js";

/**
 * Integration tests verifying the full event pipeline:
 * adapter emits event → store captures → analysis engine consumes
 */

describe("event pipeline: stores → analysis", () => {
  let queryStore: QueryStore;
  let fetchStore: FetchStore;
  let logStore: LogStore;
  let errorStore: ErrorStore;

  function routeEvent(event: TelemetryEvent): void {
    switch (event.type) {
      case "query": queryStore.add(event.data); break;
      case "fetch": fetchStore.add(event.data); break;
      case "log": logStore.add(event.data); break;
      case "error": errorStore.add(event.data); break;
    }
  }

  beforeEach(() => {
    queryStore = new QueryStore();
    fetchStore = new FetchStore();
    logStore = new LogStore();
    errorStore = new ErrorStore();
  });

  it("routes query events to the query store", () => {
    routeEvent({
      type: "query",
      data: {
        parentRequestId: "r1",
        timestamp: Date.now(),
        driver: "pg",
        sql: "SELECT * FROM public.users",
        durationMs: 15,
        normalizedOp: "SELECT",
        table: "users",
      },
    });

    expect(queryStore.getAll()).toHaveLength(1);
    expect(queryStore.getAll()[0].driver).toBe("pg");
    expect(queryStore.getAll()[0].id).toBeTruthy();
  });

  it("routes events to correct stores by type", () => {
    routeEvent({ type: "query", data: { parentRequestId: null, timestamp: 1, driver: "pg", durationMs: 5, normalizedOp: "SELECT", table: "t" } });
    routeEvent({ type: "fetch", data: { parentRequestId: null, timestamp: 1, url: "https://api.example.com", method: "GET", statusCode: 200, durationMs: 50 } });
    routeEvent({ type: "log", data: { parentRequestId: null, timestamp: 1, level: "info", message: "hello" } });
    routeEvent({ type: "error", data: { parentRequestId: null, timestamp: 1, name: "Error", message: "fail", stack: "" } });

    expect(queryStore.getAll()).toHaveLength(1);
    expect(fetchStore.getAll()).toHaveLength(1);
    expect(logStore.getAll()).toHaveLength(1);
    expect(errorStore.getAll()).toHaveLength(1);
  });

  it("stores assign unique IDs to entries", () => {
    routeEvent({ type: "query", data: { parentRequestId: null, timestamp: 1, driver: "pg", durationMs: 5, normalizedOp: "SELECT", table: "t" } });
    routeEvent({ type: "query", data: { parentRequestId: null, timestamp: 2, driver: "pg", durationMs: 5, normalizedOp: "SELECT", table: "t" } });

    const all = queryStore.getAll();
    expect(all[0].id).not.toBe(all[1].id);
  });

  it("stores support request correlation via parentRequestId", () => {
    routeEvent({ type: "query", data: { parentRequestId: "r1", timestamp: 1, driver: "pg", durationMs: 5, normalizedOp: "SELECT", table: "users" } });
    routeEvent({ type: "query", data: { parentRequestId: "r1", timestamp: 2, driver: "pg", durationMs: 5, normalizedOp: "SELECT", table: "posts" } });
    routeEvent({ type: "query", data: { parentRequestId: "r2", timestamp: 3, driver: "pg", durationMs: 5, normalizedOp: "SELECT", table: "comments" } });

    expect(queryStore.getByRequest("r1")).toHaveLength(2);
    expect(queryStore.getByRequest("r2")).toHaveLength(1);
    expect(queryStore.getByRequest("r3")).toHaveLength(0);
  });

  it("store data is consumable by the insight runner", () => {
    // Simulate: adapter emits 6 similar queries for one request → N+1 detection
    const req = makeRequest({ id: "r1" });
    for (let i = 1; i <= 6; i++) {
      routeEvent({
        type: "query",
        data: {
          parentRequestId: "r1",
          timestamp: Date.now(),
          driver: "pg",
          sql: `SELECT * FROM public.posts WHERE user_id = ${i}`,
          durationMs: 10,
          normalizedOp: "SELECT",
          table: "posts",
        },
      });
    }

    const runner = new InsightRunner();
    runner.register(n1Rule);

    const ctx = makeInsightContext({
      requests: [req],
      queries: queryStore.getAll() as never,
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("n1");
  });

  it("store data is consumable by the security scanner", () => {
    const scanner = new SecurityScanner();
    scanner.register(exposedSecretRule);
    scanner.register(tokenInUrlRule);

    const req = makeRequest({
      url: "/api/data?access_token=secret123",
      path: "/api/data",
      responseBody: JSON.stringify({ apiKey: "sk-secret-key-12345" }),
    });

    const findings = scanner.scan({ requests: [req], logs: [] });
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.rule === "token-in-url")).toBe(true);
  });

  it("error events flow through to insight engine", () => {
    routeEvent({
      type: "error",
      data: { parentRequestId: "r1", timestamp: 1, name: "TypeError", message: "Cannot read property", stack: "" },
    });
    routeEvent({
      type: "error",
      data: { parentRequestId: "r1", timestamp: 2, name: "TypeError", message: "x is not a function", stack: "" },
    });

    const runner = new InsightRunner();
    runner.register(errorRule);

    const ctx = makeInsightContext({
      errors: errorStore.getAll() as never,
    });

    const insights = runner.run(ctx);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("error");
    expect(insights[0].desc).toContain("2 times");
  });
});
