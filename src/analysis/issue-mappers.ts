import type { Insight, InsightType } from "./insights/types.js";
import type { SecurityFinding } from "../types/security.js";
import type { Issue, IssueCategory } from "../types/issue-lifecycle.js";
import { extractEndpointFromDesc } from "../utils/endpoint.js";

export function categorizeInsight(type: InsightType): IssueCategory {
  if (type === "security") return "security";
  if (type === "error" || type === "error-hotspot") return "reliability";
  return "performance";
}

export function insightToIssue(insight: Insight): Issue {
  return {
    category: categorizeInsight(insight.type),
    rule: insight.type,
    severity: insight.severity,
    title: insight.title,
    desc: insight.desc,
    hint: insight.hint,
    detail: insight.detail,
    endpoint: extractEndpointFromDesc(insight.desc) ?? undefined,
  };
}

export function securityFindingToIssue(finding: SecurityFinding): Issue {
  return {
    category: "security",
    rule: finding.rule,
    severity: finding.severity,
    title: finding.title,
    desc: finding.desc,
    hint: finding.hint,
    detail: finding.detail,
    endpoint: finding.endpoint,
  };
}
