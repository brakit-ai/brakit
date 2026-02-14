import type { AnalysisPattern } from "../../core/plugin/types.js";
import { definePattern } from "../../core/plugin/helpers.js";
import { getLineNumber } from "../../core/layers/layer2-ast/parser.js";

const AUTH_SOURCES = [
  "next-auth",
  "next-auth/next",
  "next-auth/react",
  "@clerk/nextjs",
  "@auth/core",
  "@supabase/auth-helpers-nextjs",
  "@supabase/ssr",
];

const VALIDATION_LIBS = ["zod", "yup", "joi", "@sinclair/typebox", "valibot"];

const SERVER_ONLY_MODULES = [
  "@prisma/client",
  "fs",
  "fs/promises",
  "node:fs",
  "node:fs/promises",
  "crypto",
  "node:crypto",
  "child_process",
  "node:child_process",
  "server-only",
  "next/headers",
];

const SENSITIVE_ENV_PATTERN =
  /NEXT_PUBLIC_\w*(SECRET|KEY|PASSWORD|TOKEN|PRIVATE|CREDENTIAL)/gi;

export const nextjsPatterns: Record<string, AnalysisPattern> = {
  "unprotected-route": definePattern({
    description: "API route without authentication check",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "high",
    analyze: (ctx) => {
      if (!ctx.roles.includes("api-route")) return [];

      const hasAuthImport = ctx.fileAnalysis.ast.imports.some((i) =>
        AUTH_SOURCES.some((src) => i.source.startsWith(src)),
      );
      if (hasAuthImport) return [];

      const hasAuthPattern =
        /\b(session|getServerSession|getToken|currentUser|getUser|auth\(\))\b/.test(
          ctx.contents,
        );
      if (hasAuthPattern) return [];

      return [
        {
          title: "Unprotected API route",
          message:
            "API route exports HTTP handlers without any authentication check.",
          recommendation:
            "Add authentication using your auth provider (e.g., getServerSession, auth(), currentUser).",
        },
      ];
    },
  }),

  "unvalidated-input": definePattern({
    description: "API route reads user input without validation",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "medium",
    analyze: (ctx) => {
      if (!ctx.roles.includes("api-route")) return [];

      const hasInputUsage =
        /request\.(json|formData|text)\s*\(\)|\.searchParams|\.nextUrl|params\./i.test(
          ctx.contents,
        );
      if (!hasInputUsage) return [];

      const hasValidation = ctx.fileAnalysis.ast.imports.some((i) =>
        VALIDATION_LIBS.some((lib) => i.source.startsWith(lib)),
      );
      if (hasValidation) return [];

      return [
        {
          title: "Unvalidated request input",
          message:
            "API route reads user input without schema validation.",
          recommendation:
            "Validate input with zod, yup, or similar before processing.",
        },
      ];
    },
  }),

  "dangerous-html": definePattern({
    description: "dangerouslySetInnerHTML usage",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "high",
    confidence: "certain",
    analyze: (ctx) => {
      const regex = /dangerouslySetInnerHTML/g;
      const matches = [];
      let m;
      while ((m = regex.exec(ctx.contents)) !== null) {
        matches.push({
          title: "Dangerous HTML injection",
          message:
            "dangerouslySetInnerHTML bypasses React's XSS protection.",
          line: getLineNumber(ctx.contents, m.index),
          recommendation:
            "Sanitize HTML with DOMPurify or use a safe rendering approach.",
        });
      }
      return matches;
    },
  }),

  "no-error-handling": definePattern({
    description: "Async API route handler without error handling",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "reliability",
    severity: "medium",
    analyze: (ctx) => {
      if (!ctx.roles.includes("api-route")) return [];

      const hasAsyncHandler = ctx.fileAnalysis.ast.functions.some(
        (f) => f.isAsync && f.isExported,
      );
      if (!hasAsyncHandler) return [];

      const hasTryCatch = /\btry\s*\{/.test(ctx.contents);
      if (hasTryCatch) return [];

      return [
        {
          title: "No error handling in API route",
          message:
            "Async API route handler has no try/catch. Unhandled errors will return 500.",
          recommendation:
            "Wrap handler logic in try/catch and return appropriate error responses.",
        },
      ];
    },
  }),

  "missing-use-client": definePattern({
    description: "Component uses client hooks without 'use client' directive",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "reliability",
    severity: "medium",
    analyze: (ctx) => {
      if (!ctx.roles.includes("client-component")) return [];
      if (ctx.fileAnalysis.ast.directives.includes("use client")) return [];

      return [
        {
          title: "Missing 'use client' directive",
          message:
            "Component uses React hooks but lacks 'use client' directive. This will fail in a server component context.",
          recommendation:
            "Add 'use client' at the top of the file.",
        },
      ];
    },
  }),

  "server-import-in-client": definePattern({
    description: "Client component imports server-only modules",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "critical",
    confidence: "certain",
    analyze: (ctx) => {
      if (!ctx.fileAnalysis.ast.directives.includes("use client")) return [];

      const serverImports = ctx.fileAnalysis.ast.imports.filter((i) =>
        SERVER_ONLY_MODULES.includes(i.source),
      );

      return serverImports.map((i) => ({
        title: "Server-only import in client component",
        message: `Client component imports "${i.source}" which is server-only. This exposes server code to the browser.`,
        line: i.line,
        recommendation:
          "Move server logic to a server component or API route.",
      }));
    },
  }),

  "exposed-env": definePattern({
    description: "NEXT_PUBLIC_ env var with sensitive-looking name",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "security",
    severity: "high",
    analyze: (ctx) => {
      const matches = [];
      let m;
      while ((m = SENSITIVE_ENV_PATTERN.exec(ctx.contents)) !== null) {
        matches.push({
          title: "Sensitive env var exposed to client",
          message: `"${m[0]}" is prefixed with NEXT_PUBLIC_ and will be sent to the browser.`,
          line: getLineNumber(ctx.contents, m.index),
          recommendation:
            "Remove the NEXT_PUBLIC_ prefix. Use a server-side API route to access this value.",
        });
      }
      // Reset regex lastIndex for next file.
      SENSITIVE_ENV_PATTERN.lastIndex = 0;
      return matches;
    },
  }),

  "large-client-component": definePattern({
    description: "Client component exceeding 200 lines",
    fileGlob: "**/*.{ts,tsx,js,jsx}",
    pillar: "performance",
    severity: "low",
    confidence: "tentative",
    analyze: (ctx) => {
      if (!ctx.fileAnalysis.ast.directives.includes("use client")) return [];

      const lineCount = ctx.contents.split("\n").length;
      if (lineCount <= 200) return [];

      return [
        {
          title: "Large client component",
          message: `Client component is ${lineCount} lines. Large 'use client' files increase bundle size.`,
          recommendation:
            "Split into smaller components. Only the interactive parts need 'use client'.",
        },
      ];
    },
  }),
};
