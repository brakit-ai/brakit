import type { ProjectContext } from "../../core/types/context.js";
import type { BrakitPlugin, CompoundContext } from "../../core/plugin/types.js";
import type { CompoundFinding } from "../../core/types/findings.js";
import { defineCompoundRule } from "../../core/plugin/helpers.js";

function crossFileCorrelate(
  context: CompoundContext,
  patternA: string,
  patternB: string,
  message: string,
  rationale: string,
): CompoundFinding[] {
  const findingsA = context.findingsByPattern.get(patternA) ?? [];
  const findingsB = context.findingsByPattern.get(patternB) ?? [];
  const compounds: CompoundFinding[] = [];
  const seen = new Set<string>();

  for (const a of findingsA) {
    // Same-file match first — highest confidence
    const sameFile = findingsB.filter((b) => b.filePath === a.filePath);
    if (sameFile.length > 0) {
      const key = `${a.filePath}:same`;
      if (seen.has(key)) continue;
      seen.add(key);
      compounds.push({
        id: "",
        ruleId: context.ruleId,
        severity: "critical",
        confidence: "certain",
        message,
        rationale: `${rationale} Both patterns found in ${a.filePath}.`,
        constituentFindings: [a, sameFile[0]],
        pillars: ["security"],
      });
      continue;
    }

    // Cross-file match via import graph
    for (const b of findingsB) {
      if (!context.importGraph.areConnected(a.filePath, b.filePath)) continue;
      const key = `${a.filePath}:${b.filePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      compounds.push({
        id: "",
        ruleId: context.ruleId,
        severity: "critical",
        confidence: "firm",
        message,
        rationale: `${rationale} ${a.filePath} is connected to ${b.filePath} via imports.`,
        constituentFindings: [a, b],
        pillars: ["security"],
      });
    }
  }

  return compounds;
}

function standaloneEscalate(
  context: CompoundContext,
  patternId: string,
  message: string,
  rationale: string,
): CompoundFinding[] {
  const findings = context.findingsByPattern.get(patternId) ?? [];
  return findings.map((f) => ({
    id: "",
    ruleId: context.ruleId,
    severity: "critical" as const,
    confidence: f.confidence,
    message,
    rationale,
    constituentFindings: [f],
    pillars: ["security" as const],
  }));
}

export function compounds(_context?: ProjectContext): BrakitPlugin {
  return {
    name: "compounds",
    version: "0.1.0",
    compoundRules: {
      "unprotected-raw-query": defineCompoundRule({
        description:
          "Unprotected API route executing raw database queries without authentication",
        requires: ["nextjs:unprotected-route", "prisma:raw-query"],
        severity: "critical",
        correlate: (ctx) =>
          crossFileCorrelate(
            ctx,
            "nextjs:unprotected-route",
            "prisma:raw-query",
            "Unprotected route executes raw SQL — attackers can access or manipulate data without authentication.",
            "An API route with no auth check uses $queryRaw or $executeRaw.",
          ),
      }),

      "unvalidated-db-write": defineCompoundRule({
        description:
          "Unvalidated user input passed to raw database query",
        requires: ["nextjs:unvalidated-input", "prisma:raw-query"],
        severity: "critical",
        correlate: (ctx) =>
          crossFileCorrelate(
            ctx,
            "nextjs:unvalidated-input",
            "prisma:raw-query",
            "Unvalidated input flows into raw SQL — potential SQL injection vector.",
            "User input is consumed without validation in a file connected to raw query execution.",
          ),
      }),

      "unprotected-no-rls": defineCompoundRule({
        description:
          "Unprotected API route accessing Supabase tables without Row Level Security",
        requires: ["nextjs:unprotected-route", "supabase:no-rls"],
        severity: "high",
        correlate: (ctx) => {
          const compounds = crossFileCorrelate(
            ctx,
            "nextjs:unprotected-route",
            "supabase:no-rls",
            "Unprotected route accesses Supabase without RLS — any user can read/write all rows.",
            "An unauthenticated route uses a Supabase client on a table with RLS disabled.",
          );
          for (const c of compounds) {
            c.severity = "high";
          }
          return compounds;
        },
      }),

      "no-auth-db-access": defineCompoundRule({
        description:
          "Database query fetching all records without a session check",
        requires: ["auth:missing-session-check", "prisma:select-all"],
        severity: "high",
        correlate: (ctx) => {
          const compounds = crossFileCorrelate(
            ctx,
            "auth:missing-session-check",
            "prisma:select-all",
            "A handler with no session check performs an unscoped database select — data may be exposed.",
            "No authentication guard before a findMany/findFirst without a WHERE clause.",
          );
          for (const c of compounds) {
            c.severity = "high";
          }
          return compounds;
        },
      }),

      "exposed-service-key": defineCompoundRule({
        description:
          "Supabase service-role key used in code reachable by clients",
        requires: ["supabase:service-role-client"],
        severity: "critical",
        correlate: (ctx) =>
          standaloneEscalate(
            ctx,
            "supabase:service-role-client",
            "Service-role key detected — this key bypasses RLS and grants full database access.",
            "The supabase-js client is initialized with the service_role key, which should never be exposed to clients.",
          ),
      }),
    },
  };
}
