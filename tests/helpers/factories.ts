import { randomUUID } from "node:crypto";
import type { TracedRequest } from "../../src/types/http.js";
import type {
  TracedQuery,
  TracedFetch,
  TracedLog,
  TracedError,
  TelemetryEvent,
} from "../../src/types/telemetry.js";
import type { SecurityContext } from "../../src/analysis/rules/rule.js";
import type { Insight, InsightContext } from "../../src/analysis/insights/types.js";
import type { StatefulInsight } from "../../src/types/insight-lifecycle.js";
import type { AnalysisUpdate } from "../../src/analysis/engine.js";
import type { SecurityFinding } from "../../src/types/security.js";
import type { CaptureInput } from "../../src/store/request-store.js";
import { extractEndpointFromDesc } from "../../src/utils/endpoint.js";

export function makeRequest(
  overrides: Partial<TracedRequest> = {},
): TracedRequest {
  return {
    id: "req-" + randomUUID().slice(0, 8),
    method: "GET",
    url: "/api/users",
    path: "/api/users",
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

export function makeQuery(
  overrides: Partial<TracedQuery> = {},
): TracedQuery {
  return {
    id: "q-" + randomUUID().slice(0, 8),
    parentRequestId: null,
    timestamp: Date.now(),
    driver: "pg",
    sql: "SELECT * FROM users WHERE id = $1",
    durationMs: 10,
    normalizedOp: "SELECT",
    table: "users",
    ...overrides,
  };
}

export function makeFetch(
  overrides: Partial<TracedFetch> = {},
): TracedFetch {
  return {
    id: "f-" + randomUUID().slice(0, 8),
    parentRequestId: null,
    timestamp: Date.now(),
    url: "https://api.example.com/data",
    method: "GET",
    statusCode: 200,
    durationMs: 100,
    ...overrides,
  };
}

export function makeLog(
  overrides: Partial<TracedLog> = {},
): TracedLog {
  return {
    id: "log-" + randomUUID().slice(0, 8),
    parentRequestId: null,
    timestamp: Date.now(),
    level: "log",
    message: "test message",
    ...overrides,
  };
}

export function makeError(
  overrides: Partial<TracedError> = {},
): TracedError {
  return {
    id: "err-" + randomUUID().slice(0, 8),
    parentRequestId: null,
    timestamp: Date.now(),
    name: "Error",
    message: "test error",
    stack: "Error: test error\n    at test.ts:1:1",
    ...overrides,
  };
}

export function makeSecurityContext(
  overrides: Partial<SecurityContext> = {},
): SecurityContext {
  return {
    requests: [],
    logs: [],
    ...overrides,
  };
}

export function makeInsightContext(
  overrides: Partial<InsightContext> = {},
): InsightContext {
  return {
    requests: [],
    queries: [],
    errors: [],
    flows: [],
    fetches: [],
    ...overrides,
  };
}

export function makeQueryEvent(
  overrides: Partial<TracedQuery> = {},
): TelemetryEvent {
  const { id: _, ...data } = makeQuery(overrides);
  return { type: "query", data };
}

export function makeFetchEvent(
  overrides: Partial<TracedFetch> = {},
): TelemetryEvent {
  const { id: _, ...data } = makeFetch(overrides);
  return { type: "fetch", data };
}

export function makeLogEvent(
  overrides: Partial<TracedLog> = {},
): TelemetryEvent {
  const { id: _, ...data } = makeLog(overrides);
  return { type: "log", data };
}

export function makeErrorEvent(
  overrides: Partial<TracedError> = {},
): TelemetryEvent {
  const { id: _, ...data } = makeError(overrides);
  return { type: "error", data };
}

export function makeCaptureInput(
  overrides: Partial<CaptureInput> = {},
): CaptureInput {
  return {
    requestId: randomUUID(),
    method: "GET",
    url: "/api/users",
    requestHeaders: {},
    requestBody: null,
    statusCode: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: Buffer.from('{"ok":true}'),
    responseContentType: "application/json",
    startTime: performance.now() - 25,
    config: { maxBodyCapture: 10240 },
    ...overrides,
  };
}

export function makeInsight(
  overrides: Partial<Insight> = {},
): Insight {
  return {
    severity: "warning",
    type: "slow",
    title: "Slow Endpoint",
    desc: "GET /api/users — avg 2.1s",
    hint: "Check queries",
    ...overrides,
  };
}

export function makeStatefulInsight(
  overrides: Partial<Insight> = {},
  stateOverrides: Partial<Omit<StatefulInsight, "insight">> = {},
): StatefulInsight {
  const insight = makeInsight(overrides);
  return {
    key: `${insight.type}:${extractEndpointFromDesc(insight.desc) ?? insight.title}`,
    state: "open",
    insight,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    resolvedAt: null,
    consecutiveAbsences: 0,
    ...stateOverrides,
  };
}

export function makeAnalysisUpdate(
  insights: Insight[] = [],
  findings: SecurityFinding[] = [],
): AnalysisUpdate {
  return {
    insights,
    findings,
    statefulFindings: [],
    statefulInsights: insights.map((i) => makeStatefulInsight(i)),
  };
}
