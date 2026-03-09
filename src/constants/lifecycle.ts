import type { FindingState, AiFixStatus } from "../types/finding-lifecycle.js";
import type { SecuritySeverity } from "../types/security.js";

export const VALID_FINDING_STATES = new Set<FindingState>(["open", "fixing", "resolved"]);
export const VALID_AI_FIX_STATUSES = new Set<AiFixStatus>(["fixed", "wont_fix"]);
export const VALID_SECURITY_SEVERITIES = new Set<SecuritySeverity>(["critical", "warning"]);
