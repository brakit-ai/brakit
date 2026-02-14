import type { ProjectContext } from "../../core/types/context.js";
import type { BrakitPlugin } from "../../core/plugin/types.js";
import { defineFileRole } from "../../core/plugin/helpers.js";

export function prisma(_context?: ProjectContext): BrakitPlugin {
  return {
    name: "prisma",
    version: "0.1.0",

    fileRoles: {
      "db-query": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const importsPrisma = ctx.ast.imports.some(
            (i) =>
              i.source === "@prisma/client" || i.source.endsWith("/prisma"),
          );
          return importsPrisma ? ["db-query"] : [];
        },
      }),

      "db-schema": defineFileRole({
        fileGlob: "**/*.prisma",
        classify: () => ["db-schema"],
      }),
    },
  };
}
