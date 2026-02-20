import type { SecurityRule, SecurityContext } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import { exposedSecretRule } from "./exposed-secret.js";
import { tokenInUrlRule } from "./token-in-url.js";
import { stackTraceLeakRule } from "./stack-trace-leak.js";
import { errorInfoLeakRule } from "./error-info-leak.js";
import { insecureCookieRule } from "./insecure-cookie.js";
import { sensitiveLogsRule } from "./sensitive-logs.js";
import { corsCredentialsRule } from "./cors-credentials.js";

export class SecurityScanner {
  private rules: SecurityRule[] = [];

  register(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  scan(ctx: SecurityContext): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const rule of this.rules) {
      try {
        findings.push(...rule.check(ctx));
      } catch {
        // One rule failing doesn't stop others
      }
    }
    return findings;
  }

  getRules(): readonly SecurityRule[] {
    return this.rules;
  }
}

export function createDefaultScanner(): SecurityScanner {
  const scanner = new SecurityScanner();
  scanner.register(exposedSecretRule);
  scanner.register(tokenInUrlRule);
  scanner.register(stackTraceLeakRule);
  scanner.register(errorInfoLeakRule);
  scanner.register(insecureCookieRule);
  scanner.register(sensitiveLogsRule);
  scanner.register(corsCredentialsRule);
  return scanner;
}
