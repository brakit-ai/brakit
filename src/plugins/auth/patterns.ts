import type { AnalysisPattern } from "../../core/plugin/types.js";
import { definePattern } from "../../core/plugin/helpers.js";
import { getLineNumber } from "../../core/layers/layer2-ast/parser.js";

const SECRET_PATTERNS = [
  /\b(jwt|auth|api|secret|private)[-_]?(key|secret|token)\s*[:=]\s*["'`][A-Za-z0-9+/=_-]{20,}["'`]/gi,
  /\b(sk_|pk_|key_)[a-zA-Z0-9]{20,}/g,
];

const SESSION_CHECK_PATTERNS = [
  "getServerSession",
  "getToken",
  "auth(",
  "currentUser",
  "getUser(",
  "session",
  "createServerClient",
  "createClient",
];

export const authPatterns: Record<string, AnalysisPattern> = {
  "hardcoded-secret": definePattern({
    description: "Hardcoded authentication secret in source code",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "critical",
    confidence: "firm",
    analyze: (ctx) => {
      const matches = [];

      for (const pattern of SECRET_PATTERNS) {
        let m;
        // Reset lastIndex for global regexes.
        pattern.lastIndex = 0;
        while ((m = pattern.exec(ctx.contents)) !== null) {
          matches.push({
            title: "Hardcoded secret",
            message:
              "Authentication secret or API key appears to be hardcoded in source code.",
            line: getLineNumber(ctx.contents, m.index),
            recommendation:
              "Move secrets to environment variables. Never commit secrets to source control.",
          });
        }
      }

      return matches;
    },
  }),

  "missing-session-check": definePattern({
    description: "API route without session validation",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "high",
    analyze: (ctx) => {
      if (!ctx.roles.includes("api-route")) return [];

      const hasSessionCheck = SESSION_CHECK_PATTERNS.some((p) =>
        ctx.contents.includes(p),
      );
      if (hasSessionCheck) return [];

      return [
        {
          title: "API route without session validation",
          message:
            "API route has no session or authentication check. Endpoints should validate the caller's identity.",
          recommendation:
            "Add session validation using your auth provider before processing the request.",
        },
      ];
    },
  }),
};
