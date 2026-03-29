import type { StatefulIssue } from "../store/types.js";
import type { IssueCategory } from "../../../types/shared.js";

export type { IssueCategory };

export const SECURITY_RULES: ReadonlySet<string> = new Set([
  "exposed-secret", "token-in-url", "stack-trace-leak", "error-info-leak",
  "insecure-cookie", "sensitive-logs", "cors-credentials", "response-pii-leak",
]);

export const PERFORMANCE_RULES: ReadonlySet<string> = new Set([
  "slow-endpoint", "n1", "high-query-count",
]);

export function categorizeIssue(entry: StatefulIssue): IssueCategory {
  const rule = entry.issue.rule;
  if (SECURITY_RULES.has(rule)) return "security";
  if (PERFORMANCE_RULES.has(rule)) return "performance";
  return "reliability";
}
