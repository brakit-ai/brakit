import type { Severity } from "../types/security.js";

/** Unicode icons per severity level. */
export const SEVERITY_ICON: Record<Severity, string> = {
  critical: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
};

/** Numeric priority for sorting (lower = more severe). */
export const SEVERITY_SORT_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};
