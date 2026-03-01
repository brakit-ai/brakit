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

export const SEVERITY_CRITICAL = "critical" as const;
export const SEVERITY_WARNING = "warning" as const;
export const SEVERITY_INFO = "info" as const;

export const SEVERITY_ICON_MAP = {
  [SEVERITY_CRITICAL]: { icon: "\u2717", cls: "critical" },
  [SEVERITY_WARNING]: { icon: "\u26A0", cls: "warning" },
  [SEVERITY_INFO]: { icon: "\u2139", cls: "info" },
} as const;
