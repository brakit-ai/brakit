export type { Severity } from "./shared.js";

import type { Severity } from "./shared.js";

export type SecuritySeverity = Severity;

export interface SecurityFinding {
  severity: SecuritySeverity;
  rule: string;
  title: string;
  desc: string;
  hint: string;
  detail?: string;
  endpoint: string;
  count: number;
}
