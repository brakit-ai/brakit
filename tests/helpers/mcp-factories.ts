import { vi } from "vitest";
import type { SecurityFinding } from "../../src/types/security.js";
import type { StatefulFinding, FindingState, FindingSource } from "../../src/types/finding-lifecycle.js";
import type { EnrichedFinding, EndpointSummary } from "../../src/mcp/types.js";
import type { BrakitClient } from "../../src/mcp/client.js";
import { computeFindingId } from "../../src/store/finding-id.js";

export function makeSecurityFinding(
  overrides: Partial<SecurityFinding> = {},
): SecurityFinding {
  return {
    severity: "warning",
    rule: "test-rule",
    title: "Test Finding",
    desc: "A test finding description",
    hint: "Fix by doing X",
    endpoint: "GET /api/test",
    count: 1,
    ...overrides,
  };
}

export function makeStatefulFinding(
  overrides: Partial<StatefulFinding> = {},
): StatefulFinding {
  const finding = overrides.finding ?? makeSecurityFinding();
  return {
    findingId: computeFindingId(finding),
    state: "open" as FindingState,
    source: "passive" as FindingSource,
    finding,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    resolvedAt: null,
    occurrences: 1,
    aiStatus: null,
    aiNotes: null,
    ...overrides,
  };
}

export function makeEnrichedFinding(
  overrides: Partial<EnrichedFinding> = {},
): EnrichedFinding {
  const base = makeSecurityFinding();
  return {
    findingId: computeFindingId(base),
    severity: "warning",
    title: "Test Finding",
    endpoint: "GET /api/test",
    description: "A test description",
    hint: "Fix by doing X",
    occurrences: 1,
    context: "",
    aiStatus: null,
    aiNotes: null,
    ...overrides,
  };
}

export function makeEndpointSummary(
  overrides: Partial<EndpointSummary> = {},
): EndpointSummary {
  return {
    endpoint: "GET /api/test",
    p95Ms: 100,
    errorRate: 0,
    avgQueryCount: 2,
    totalRequests: 10,
    avgQueryTimeMs: 5,
    avgFetchTimeMs: 20,
    avgAppTimeMs: 75,
    ...overrides,
  };
}

export function makeMockClient(
  overrides: Partial<Record<keyof BrakitClient, unknown>> = {},
): BrakitClient {
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
    reportFix: vi.fn().mockResolvedValue(true),
    isAlive: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as BrakitClient;
}
