import type { AnalysisPattern } from "../../core/plugin/types.js";
import { definePattern } from "../../core/plugin/helpers.js";
import { getLineNumber } from "../../core/stages/parse/parser.js";

export const supabasePatterns: Record<string, AnalysisPattern> = {
  "service-role-client": definePattern({
    description: "Service role key used in potentially client-accessible code",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "critical",
    confidence: "certain",
    analyze: (ctx) => {
      const regex = /\b(service_role|SUPABASE_SERVICE_ROLE_KEY)\b/g;
      const matches = [];
      let m;
      while ((m = regex.exec(ctx.contents)) !== null) {
        matches.push({
          title: "Supabase service role key in source",
          message: `"${m[0]}" found in source code. The service role key bypasses Row Level Security.`,
          line: getLineNumber(ctx.contents, m.index),
          recommendation:
            "Use the anon key for client-side code. Only use the service role key in server-side code with proper access controls.",
        });
      }
      return matches;
    },
  }),

  "no-rls": definePattern({
    description: "Supabase query without RLS consideration",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "medium",
    confidence: "tentative",
    analyze: (ctx) => {
      if (!ctx.roles.includes("db-query")) return [];

      const importsSupabase = ctx.fileAnalysis.ast.imports.some(
        (i) => i.source === "@supabase/supabase-js",
      );
      if (!importsSupabase) return [];

      const hasFromQuery = /\.from\s*\(\s*['"`]/.test(ctx.contents);
      if (!hasFromQuery) return [];

      // If the file also uses auth helpers, RLS is likely handled.
      const hasAuthHelper = ctx.fileAnalysis.ast.imports.some(
        (i) =>
          i.source === "@supabase/ssr" ||
          i.source === "@supabase/auth-helpers-nextjs",
      );
      if (hasAuthHelper) return [];

      return [
        {
          title: "Supabase query without apparent RLS",
          message:
            "Supabase .from() query found without auth helper imports. Ensure Row Level Security policies are in place.",
          recommendation:
            "Use authenticated Supabase clients (via @supabase/ssr) so RLS policies apply.",
        },
      ];
    },
  }),
};
