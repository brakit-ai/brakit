import type { AnalysisPattern } from "../../core/plugin/types.js";
import { definePattern } from "../../core/plugin/helpers.js";
import { getLineNumber } from "../../core/stages/parse/parser.js";

export const prismaPatterns: Record<string, AnalysisPattern> = {
  "raw-query": definePattern({
    description: "Raw SQL query usage",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "high",
    confidence: "certain",
    analyze: (ctx) => {
      if (!ctx.roles.includes("db-query")) return [];

      const regex = /\.\$(queryRaw|executeRaw)\b/g;
      const matches = [];
      let m;
      while ((m = regex.exec(ctx.contents)) !== null) {
        matches.push({
          title: "Raw SQL query",
          message: `$${m[1]} bypasses Prisma's query builder and is vulnerable to SQL injection if inputs are not parameterized.`,
          line: getLineNumber(ctx.contents, m.index),
          recommendation:
            "Use Prisma's query builder or ensure all inputs use tagged template parameterization.",
        });
      }
      return matches;
    },
  }),

  "no-pagination": definePattern({
    description: "findMany without pagination",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "performance",
    severity: "medium",
    analyze: (ctx) => {
      if (!ctx.roles.includes("db-query")) return [];

      const hasFindMany = /\.findMany\s*\(/g.test(ctx.contents);
      if (!hasFindMany) return [];

      const hasPagination = /\b(take|skip|cursor)\s*:/g.test(ctx.contents);
      if (hasPagination) return [];

      return [
        {
          title: "findMany without pagination",
          message:
            "findMany called without take/skip. This returns all rows and can cause performance issues on large tables.",
          recommendation:
            "Add take and skip parameters, or use cursor-based pagination.",
        },
      ];
    },
  }),

  "select-all": definePattern({
    description: "Query without select clause",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "privacy",
    severity: "low",
    confidence: "tentative",
    analyze: (ctx) => {
      if (!ctx.roles.includes("db-query")) return [];

      const queryMethods =
        /\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow)\s*\(/g;
      if (!queryMethods.test(ctx.contents)) return [];

      const hasSelect = /\bselect\s*:/g.test(ctx.contents);
      if (hasSelect) return [];

      return [
        {
          title: "Query returns all fields",
          message:
            "Prisma query has no select clause. All model fields are returned, potentially including sensitive data.",
          recommendation:
            "Add a select clause to return only the fields needed.",
        },
      ];
    },
  }),
};
