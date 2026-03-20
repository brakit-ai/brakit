import type { IssueState, IssueCategory, AiFixStatus, IssuesData } from "../types/issue-lifecycle.js";
import type { MetricsData } from "../types/metrics.js";
import { VALID_ISSUE_STATES, VALID_ISSUE_CATEGORIES, VALID_AI_FIX_STATUSES, ISSUES_DATA_VERSION } from "../constants/config.js";

export function isString(val: unknown): val is string {
  return typeof val === "string";
}

export function isNumber(val: unknown): val is number {
  return typeof val === "number" && !isNaN(val);
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

export function isBoolean(val: unknown): val is boolean {
  return typeof val === "boolean";
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

export function isValidIssueState(val: unknown): val is IssueState {
  return typeof val === "string" && VALID_ISSUE_STATES.has(val as IssueState);
}

export function isValidIssueCategory(val: unknown): val is IssueCategory {
  return typeof val === "string" && VALID_ISSUE_CATEGORIES.has(val as IssueCategory);
}

export function isValidAiFixStatus(val: unknown): val is AiFixStatus {
  return typeof val === "string" && VALID_AI_FIX_STATUSES.has(val as AiFixStatus);
}

/**
 * Validates that a parsed JSON value conforms to the IssuesData envelope.
 * Checks version and array structure; individual issues are trusted since
 * they were serialized by this same application.
 */
export function validateIssuesData(parsed: unknown): IssuesData | null {
  if (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).version === ISSUES_DATA_VERSION &&
    Array.isArray((parsed as Record<string, unknown>).issues)
  ) {
    return parsed as IssuesData;
  }
  return null;
}

/**
 * Validates that a parsed JSON value conforms to the MetricsData envelope.
 */
export function validateMetricsData(parsed: unknown): MetricsData | null {
  if (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).version === 1 &&
    Array.isArray((parsed as Record<string, unknown>).endpoints)
  ) {
    return parsed as MetricsData;
  }
  return null;
}
