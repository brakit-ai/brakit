import type { ProjectContext } from "../../core/types/context.js";
import type { BrakitPlugin } from "../../core/plugin/types.js";
import { defineFileRole } from "../../core/plugin/helpers.js";

const CLIENT_HOOKS = [
  "useState",
  "useEffect",
  "useRef",
  "useCallback",
  "useMemo",
  "useReducer",
  "useContext",
  "useLayoutEffect",
  "useTransition",
  "useDeferredValue",
];

const SERVER_MODULES = ["next/headers", "next/cookies", "server-only"];

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

export function nextjs(_context?: ProjectContext): BrakitPlugin {
  return {
    name: "nextjs",
    version: "0.1.0",

    fileRoles: {
      "api-route": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const hasHttpExport = ctx.ast.exports.some((e) =>
            HTTP_METHODS.includes(e.name),
          );
          return hasHttpExport ? ["api-route"] : [];
        },
      }),

      page: defineFileRole({
        fileGlob: "**/page.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const hasDefault = ctx.ast.exports.some((e) => e.isDefault);
          return hasDefault ? ["page"] : [];
        },
      }),

      layout: defineFileRole({
        fileGlob: "**/layout.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const hasDefault = ctx.ast.exports.some((e) => e.isDefault);
          return hasDefault ? ["layout"] : [];
        },
      }),

      middleware: defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const exportsMiddleware = ctx.ast.exports.some(
            (e) => e.name === "middleware",
          );
          const importsNextServer = ctx.ast.imports.some(
            (i) => i.source === "next/server",
          );
          return exportsMiddleware && importsNextServer ? ["middleware"] : [];
        },
      }),

      "server-action": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          return ctx.ast.directives.includes("use server")
            ? ["server-action"]
            : [];
        },
      }),

      "client-component": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const hasDirective = ctx.ast.directives.includes("use client");
          const hasClientHook = ctx.ast.imports.some(
            (i) =>
              i.source === "react" &&
              i.specifiers.some((s) => CLIENT_HOOKS.includes(s)),
          );
          return hasDirective || hasClientHook ? ["client-component"] : [];
        },
      }),

      "server-component": defineFileRole({
        fileGlob: "**/*.{ts,tsx,js,jsx}",
        classify: (ctx) => {
          const hasServerImport = ctx.ast.imports.some((i) =>
            SERVER_MODULES.includes(i.source),
          );
          const hasUseClient = ctx.ast.directives.includes("use client");
          return hasServerImport && !hasUseClient ? ["server-component"] : [];
        },
      }),
    },
  };
}
