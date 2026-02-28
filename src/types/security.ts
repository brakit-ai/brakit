/** Shared severity levels used by both security findings and insights. */
export type Severity = "critical" | "warning" | "info";

export type SecuritySeverity = Severity;

export interface SecurityFinding {
  severity: SecuritySeverity;
  rule: string;
  title: string;
  desc: string;
  hint: string;
  endpoint: string;
  count: number;
}
