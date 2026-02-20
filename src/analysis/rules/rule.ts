import type { TracedRequest, TracedLog } from "../../types/index.js";
import type { SecurityFinding, SecuritySeverity } from "../../types/index.js";

export interface SecurityContext {
  requests: readonly TracedRequest[];
  logs: readonly TracedLog[];
}

export interface SecurityRule {
  id: string;
  severity: SecuritySeverity;
  name: string;
  hint: string;
  check(ctx: SecurityContext): SecurityFinding[];
}
