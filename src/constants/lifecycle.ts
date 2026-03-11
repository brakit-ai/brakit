import type { IssueState, IssueCategory, AiFixStatus } from "../types/issue-lifecycle.js";
import type { SecuritySeverity } from "../types/security.js";

export const VALID_ISSUE_STATES = new Set<IssueState>(["open", "fixing", "resolved", "stale", "regressed"]);
export const VALID_ISSUE_CATEGORIES = new Set<IssueCategory>(["security", "performance", "reliability"]);
export const VALID_AI_FIX_STATUSES = new Set<AiFixStatus>(["fixed", "wont_fix"]);
export const VALID_SECURITY_SEVERITIES = new Set<SecuritySeverity>(["critical", "warning"]);
