import type { SecurityFinding } from "../../src/types/security.js";
import type { StatefulFinding, FindingState, FindingSource } from "../../src/types/finding-lifecycle.js";
import type { EnrichedFinding, EndpointSummary } from "../../src/mcp/types.js";
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
