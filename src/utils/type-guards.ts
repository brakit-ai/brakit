import type { FindingState, AiFixStatus, FindingsData } from "../types/finding-lifecycle.js";
import type { MetricsData } from "../types/metrics.js";
import { VALID_FINDING_STATES, VALID_AI_FIX_STATUSES } from "../constants/lifecycle.js";
import { FINDINGS_DATA_VERSION } from "../constants/limits.js";

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

export function isValidFindingState(val: unknown): val is FindingState {
  return typeof val === "string" && VALID_FINDING_STATES.has(val as FindingState);
}

export function isValidAiFixStatus(val: unknown): val is AiFixStatus {
  return typeof val === "string" && VALID_AI_FIX_STATUSES.has(val as AiFixStatus);
}

/**
 * Validates that a parsed JSON value conforms to the FindingsData envelope.
 * Checks version and array structure; individual findings are trusted since
 * they were serialized by this same application.
 */
export function validateFindingsData(parsed: unknown): FindingsData | null {
  if (
    parsed != null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as Record<string, unknown>).version === FINDINGS_DATA_VERSION &&
    Array.isArray((parsed as Record<string, unknown>).findings)
  ) {
    return parsed as FindingsData;
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
