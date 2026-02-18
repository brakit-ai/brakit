export type SecuritySeverity = "critical" | "warning" | "info";

export interface SecurityFinding {
  severity: SecuritySeverity;
  rule: string;
  title: string;
  desc: string;
  hint: string;
  endpoint: string;
  count: number;
}
