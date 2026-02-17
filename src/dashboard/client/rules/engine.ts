import { DASHBOARD_PREFIX } from "../../../constants.js";

/** Runs all security rules against captured state and deduplicates findings. */
export function getSecurityEngine(): string {
  return `
  function computeSecurityFindings() {
    var findings = [];
    var nonDashboard = state.requests.filter(function(r) {
      return !r.isStatic && (!r.path || r.path.indexOf('${DASHBOARD_PREFIX}') !== 0);
    });

    ruleExposedSecret(nonDashboard, findings);
    ruleTokenInUrl(nonDashboard, findings);
    ruleStackTraceLeak(nonDashboard, findings);
    ruleErrorInfoLeak(nonDashboard, findings);
    ruleCorsWildcard(nonDashboard, findings);
    ruleNoAuthData(nonDashboard, findings);
    ruleSensitiveLogs(findings);
    ruleUnboundedQuery(findings);
    rule200Error(nonDashboard, findings);
    ruleCorsCredentials(nonDashboard, findings);
    ruleInsecureCookie(nonDashboard, findings);
    ruleMissingSecurityHeaders(nonDashboard, findings);

    return findings;
  }
  `;
}
