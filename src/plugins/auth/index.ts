import type { ProjectContext } from "../../core/types/context.js";
import type { BrakitPlugin } from "../../core/plugin/types.js";
import { defineFileRole } from "../../core/plugin/helpers.js";

const AUTH_MODULES = [
  "next-auth",
  "next-auth/react",
  "next-auth/next",
  "@clerk/nextjs",
  "@clerk/clerk-react",
  "@auth/core",
  "@supabase/auth-helpers-nextjs",
  "@supabase/auth-helpers-react",
  "@supabase/ssr",
  "@supabase/auth-ui-react",
];

export function auth(_context?: ProjectContext): BrakitPlugin {
  return {
    name: "auth",
    version: "0.1.0",

    fileRoles: {
      "auth-config": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const importsAuth = ctx.ast.imports.some((i) =>
            AUTH_MODULES.includes(i.source),
          );
          return importsAuth ? ["auth-config"] : [];
        },
      }),
    },
  };
}
