import type { SecurityRule, SecurityContext, ParsedBodyCache } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import type { TracedRequest, TracedLog } from "../../types/index.js";
import { tryParseJson } from "../../utils/response.js";
import { exposedSecretRule } from "./exposed-secret.js";
import { tokenInUrlRule } from "./token-in-url.js";
import { stackTraceLeakRule } from "./stack-trace-leak.js";
import { errorInfoLeakRule } from "./error-info-leak.js";
import { insecureCookieRule } from "./insecure-cookie.js";
import { sensitiveLogsRule } from "./sensitive-logs.js";
import { corsCredentialsRule } from "./cors-credentials.js";
import { responsePiiLeakRule } from "./response-pii-leak.js";

function buildBodyCache(requests: readonly TracedRequest[]): ParsedBodyCache {
  const response = new Map<string, unknown>();
  const request = new Map<string, unknown>();
  for (const r of requests) {
    if (r.responseBody) {
      const parsed = tryParseJson(r.responseBody);
      if (parsed != null) response.set(r.id, parsed);
    }
    if (r.requestBody) {
      const parsed = tryParseJson(r.requestBody);
      if (parsed != null) request.set(r.id, parsed);
    }
  }
  return { response, request };
}

export class SecurityScanner {
  private rules: SecurityRule[] = [];

  register(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  scan(input: { requests: readonly TracedRequest[]; logs: readonly TracedLog[] }): SecurityFinding[] {
    const ctx: SecurityContext = {
      ...input,
      parsedBodies: buildBodyCache(input.requests),
    };
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
  scanner.register(responsePiiLeakRule);
  return scanner;
}
