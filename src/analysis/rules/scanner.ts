import type { SecurityRule, SecurityContext, ParsedBodyCache } from "./rule.js";
import type { SecurityFinding } from "../../types/index.js";
import type { TracedRequest, TracedLog } from "../../types/index.js";
import { tryParseJson } from "../../utils/response.js";
import { brakitDebug } from "../../utils/log.js";
import { getErrorMessage } from "../../utils/type-guards.js";
import { exposedSecretRule, tokenInUrlRule, insecureCookieRule, corsCredentialsRule } from "./auth-rules.js";
import { stackTraceLeakRule, errorInfoLeakRule, sensitiveLogsRule, responsePiiLeakRule } from "./data-rules.js";

function buildBodyCache(requests: readonly TracedRequest[]): ParsedBodyCache {
  const response = new Map<string, unknown>();
  const request = new Map<string, unknown>();
  for (const req of requests) {
    if (req.responseBody) {
      const parsed = tryParseJson(req.responseBody);
      if (parsed != null) response.set(req.id, parsed);
    }
    if (req.requestBody) {
      const parsed = tryParseJson(req.requestBody);
      if (parsed != null) request.set(req.id, parsed);
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
      } catch (e) {
        brakitDebug(`rule ${rule.id} failed: ${getErrorMessage(e)}`);
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
