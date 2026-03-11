import type { FindingState, AiFixStatus } from "../types/finding-lifecycle.js";
import { VALID_FINDING_STATES, VALID_AI_FIX_STATUSES } from "../constants/lifecycle.js";

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
