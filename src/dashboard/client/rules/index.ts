import { getSecurityPatterns } from "./patterns.js";
import { getSecurityHelpers } from "./helpers.js";
import { getCriticalRules } from "./critical.js";
import { getWarningRules } from "./warnings.js";
import { getSecurityEngine } from "./engine.js";

export function getSecurityRules(): string {
  return (
    getSecurityPatterns() +
    getSecurityHelpers() +
    getCriticalRules() +
    getWarningRules() +
    getSecurityEngine()
  );
}
