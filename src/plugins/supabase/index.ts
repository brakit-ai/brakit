import type { ProjectContext } from "../../core/types/context.js";
import type { BrakitPlugin } from "../../core/plugin/types.js";
import { defineFileRole } from "../../core/plugin/helpers.js";
import { supabasePatterns } from "./patterns.js";

export function supabase(_context?: ProjectContext): BrakitPlugin {
  return {
    name: "supabase",
    version: "0.1.0",

    fileRoles: {
      "db-query": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const importsSupabase = ctx.ast.imports.some(
            (i) => i.source === "@supabase/supabase-js",
          );
          return importsSupabase ? ["db-query"] : [];
        },
      }),
    },

    patterns: supabasePatterns,
  };
}
