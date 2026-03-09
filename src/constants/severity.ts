import type { Severity } from "../types/security.js";

export const SEVERITY_ICON: Record<Severity, string> = {
  critical: "\u2717",
  warning: "\u26A0",
  info: "\u2139",
};

export const SEVERITY_SORT_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

