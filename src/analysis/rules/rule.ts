import type { TracedRequest, TracedLog } from "../../types/index.js";
import type { SecurityFinding, SecuritySeverity } from "../../types/index.js";

/** Pre-parsed JSON bodies keyed by request ID, built once per scan cycle. */
export interface ParsedBodyCache {
  response: Map<string, unknown>;
  request: Map<string, unknown>;
}

export interface SecurityContext {
  requests: readonly TracedRequest[];
  logs: readonly TracedLog[];
  parsedBodies: ParsedBodyCache;
}

export interface SecurityRule {
  id: string;
  severity: SecuritySeverity;
  name: string;
  hint: string;
  check(ctx: SecurityContext): SecurityFinding[];
}
