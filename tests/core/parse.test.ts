import { describe, it, expect } from "vitest";
import { parseFile } from "@/core/stages/parse/parser";
import { extractImports } from "@/core/stages/parse/extractors/imports";
import { extractExports } from "@/core/stages/parse/extractors/exports";
import { extractFunctions } from "@/core/stages/parse/extractors/functions";
import { extractDirectives } from "@/core/stages/parse/extractors/directives";
import { classifyFile } from "@/core/stages/parse/role-classifier";
import { runParser } from "@/core/stages/parse/index";
import { RegistryBuilder } from "@/core/plugin/registry";
import { nextjs } from "@/plugins/nextjs/index";
import { prisma } from "@/plugins/prisma/index";
import { auth } from "@/plugins/auth/index";

// ── Test fixtures ──

const API_ROUTE = `
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ created: true });
}
`;

const CLIENT_COMPONENT = `"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
`;

const SERVER_COMPONENT = `
import { cookies } from "next/headers";

export default async function Dashboard() {
  const cookieStore = cookies();
  return <div>Dashboard</div>;
}
`;

const MIDDLEWARE = `
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
`;

const SERVER_ACTION = `"use server";

export async function submitForm(data: FormData) {
  const name = data.get("name");
  return { success: true };
}
`;

const PRISMA_QUERY = `
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getUsers() {
  return prisma.user.findMany();
}
`;

const AUTH_CONFIG = `
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth } = NextAuth({
  providers: [GitHub],
});
`;

const PLAIN_UTILITY = `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export const MAX_RETRIES = 3;
`;

// ── Parser tests ──

describe("parseFile", () => {
  it("parses TypeScript files", () => {
    const module = parseFile("route.ts", API_ROUTE);
    expect(module).not.toBeNull();
    expect(module!.body.length).toBeGreaterThan(0);
  });

  it("parses TSX files", () => {
    const module = parseFile("page.tsx", CLIENT_COMPONENT);
    expect(module).not.toBeNull();
  });

  it("returns null for unsupported extensions", () => {
    expect(parseFile("styles.css", "body {}")).toBeNull();
    expect(parseFile("data.json", "{}")).toBeNull();
  });

  it("returns null on invalid syntax", () => {
    expect(parseFile("bad.ts", "export function {{{")).toBeNull();
  });
});

// ── Extractor tests ──

describe("extractImports", () => {
  it("extracts named imports", () => {
    const module = parseFile("test.ts", API_ROUTE)!;
    const imports = extractImports(module, API_ROUTE);

    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe("next/server");
    expect(imports[0].specifiers).toContain("NextResponse");
  });

  it("extracts default imports", () => {
    const module = parseFile("test.ts", AUTH_CONFIG)!;
    const imports = extractImports(module, AUTH_CONFIG);

    const nextAuthImport = imports.find((i) => i.source === "next-auth");
    expect(nextAuthImport).toBeDefined();
    expect(nextAuthImport!.specifiers).toContain("default");
  });

  it("extracts multiple imports", () => {
    const module = parseFile("test.ts", MIDDLEWARE)!;
    const imports = extractImports(module, MIDDLEWARE);

    expect(imports.length).toBeGreaterThanOrEqual(1);
    expect(imports.some((i) => i.source === "next/server")).toBe(true);
  });
});

describe("extractExports", () => {
  it("extracts named function exports", () => {
    const module = parseFile("route.ts", API_ROUTE)!;
    const exports = extractExports(module, API_ROUTE);

    const names = exports.map((e) => e.name);
    expect(names).toContain("GET");
    expect(names).toContain("POST");
    expect(exports.every((e) => !e.isDefault)).toBe(true);
    expect(exports.every((e) => e.kind === "function")).toBe(true);
  });

  it("extracts default exports", () => {
    const module = parseFile("page.tsx", CLIENT_COMPONENT)!;
    const exports = extractExports(module, CLIENT_COMPONENT);

    const defaultExport = exports.find((e) => e.isDefault);
    expect(defaultExport).toBeDefined();
    expect(defaultExport!.kind).toBe("function");
  });

  it("extracts variable exports", () => {
    const module = parseFile("utils.ts", PLAIN_UTILITY)!;
    const exports = extractExports(module, PLAIN_UTILITY);

    const names = exports.map((e) => e.name);
    expect(names).toContain("formatDate");
    expect(names).toContain("MAX_RETRIES");
  });

  it("extracts mixed exports from middleware", () => {
    const module = parseFile("middleware.ts", MIDDLEWARE)!;
    const exports = extractExports(module, MIDDLEWARE);

    const names = exports.map((e) => e.name);
    expect(names).toContain("middleware");
    expect(names).toContain("config");
  });
});

describe("extractFunctions", () => {
  it("extracts async exported functions", () => {
    const module = parseFile("route.ts", API_ROUTE)!;
    const functions = extractFunctions(module, API_ROUTE);

    const get = functions.find((f) => f.name === "GET");
    expect(get).toBeDefined();
    expect(get!.isAsync).toBe(true);
    expect(get!.isExported).toBe(true);
    expect(get!.params).toContain("request");
  });

  it("extracts default exported functions", () => {
    const module = parseFile("page.tsx", CLIENT_COMPONENT)!;
    const functions = extractFunctions(module, CLIENT_COMPONENT);

    const counter = functions.find((f) => f.name === "Counter");
    expect(counter).toBeDefined();
    expect(counter!.isExported).toBe(true);
  });

  it("extracts non-exported functions", () => {
    const module = parseFile("utils.ts", PLAIN_UTILITY)!;
    const functions = extractFunctions(module, PLAIN_UTILITY);

    expect(functions.some((f) => f.name === "formatDate")).toBe(true);
  });
});

describe("extractDirectives", () => {
  it("extracts 'use client' directive", () => {
    const module = parseFile("component.tsx", CLIENT_COMPONENT)!;
    const directives = extractDirectives(module);

    expect(directives).toContain("use client");
  });

  it("extracts 'use server' directive", () => {
    const module = parseFile("actions.ts", SERVER_ACTION)!;
    const directives = extractDirectives(module);

    expect(directives).toContain("use server");
  });

  it("returns empty for files without directives", () => {
    const module = parseFile("route.ts", API_ROUTE)!;
    const directives = extractDirectives(module);

    expect(directives).toHaveLength(0);
  });
});

// ── Role classification tests ──

describe("classifyFile", () => {
  function buildRegistry() {
    return new RegistryBuilder()
      .addPlugin(nextjs())
      .addPlugin(prisma())
      .addPlugin(auth())
      .resolve();
  }

  function classify(filePath: string, source: string) {
    const module = parseFile(filePath, source)!;
    const ast = {
      imports: extractImports(module, source),
      exports: extractExports(module, source),
      functions: extractFunctions(module, source),
      directives: extractDirectives(module),
    };
    return classifyFile(filePath, filePath, source, ast, buildRegistry());
  }

  it("classifies API route by exported HTTP methods", () => {
    const result = classify("app/api/users/route.ts", API_ROUTE);
    expect(result.roles).toContain("api-route");
  });

  it("classifies client component by 'use client' directive", () => {
    const result = classify("components/counter.tsx", CLIENT_COMPONENT);
    expect(result.roles).toContain("client-component");
  });

  it("classifies client component by React hook imports (no directive)", () => {
    const noDirective = `
import { useState } from "react";
export default function Toggle() {
  const [on, setOn] = useState(false);
  return <button onClick={() => setOn(!on)}>{on ? "ON" : "OFF"}</button>;
}
`;
    const result = classify("components/toggle.tsx", noDirective);
    expect(result.roles).toContain("client-component");
  });

  it("classifies server component by server module imports", () => {
    const result = classify("app/dashboard/page.tsx", SERVER_COMPONENT);
    expect(result.roles).toContain("server-component");
  });

  it("classifies middleware by behavior, not filename", () => {
    // The file is named "proxy.ts" but exports middleware + imports next/server.
    const result = classify("proxy.ts", MIDDLEWARE);
    expect(result.roles).toContain("middleware");
  });

  it("classifies server actions by directive", () => {
    const result = classify("lib/actions.ts", SERVER_ACTION);
    expect(result.roles).toContain("server-action");
  });

  it("classifies Prisma db-query by import", () => {
    const result = classify("lib/db.ts", PRISMA_QUERY);
    expect(result.roles).toContain("db-query");
  });

  it("classifies auth config by import", () => {
    const result = classify("lib/auth.ts", AUTH_CONFIG);
    expect(result.roles).toContain("auth-config");
  });

  it("assigns no special role to plain utilities", () => {
    const result = classify("lib/utils.ts", PLAIN_UTILITY);
    expect(result.roles).toHaveLength(0);
  });

  it("assigns multiple roles when applicable", () => {
    // API route that also imports Prisma = api-route + db-query.
    const apiWithDb = `
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}
`;
    const result = classify("app/api/users/route.ts", apiWithDb);
    expect(result.roles).toContain("api-route");
    expect(result.roles).toContain("db-query");
  });
});

// ── Full Layer 2 integration ──

describe("runParser", () => {
  it("produces FileAnalysis for each file", () => {
    const registry = new RegistryBuilder().addPlugin(nextjs()).resolve();
    const fileContents = new Map([
      ["app/api/users/route.ts", API_ROUTE],
      ["app/dashboard/page.tsx", SERVER_COMPONENT],
    ]);

    const result = runParser(
      {
        rootDir: "/test",
        filePaths: [...fileContents.keys()],
        fileContents,
        config: {
          minSeverity: "low",
          exclude: [],
          pluginOptions: {},
          scoreThreshold: 0,
        },
        projectContext: {
          rootDir: "/test",
          framework: { name: "nextjs", version: "14.0.0", details: {} },
          orm: null,
          auth: null,
          baas: null,
          packageManager: "npm",
          typescript: true,
          dependencies: {},
          devDependencies: {},
        },
      },
      registry,
    );

    expect(result.fileAnalyses).toHaveLength(2);
    expect(result.fileAnalysisMap.size).toBe(2);

    const route = result.fileAnalysisMap.get("app/api/users/route.ts");
    expect(route).toBeDefined();
    expect(route!.roles).toContain("api-route");
    expect(route!.ast.exports.length).toBeGreaterThan(0);

    const page = result.fileAnalysisMap.get("app/dashboard/page.tsx");
    expect(page).toBeDefined();
    expect(page!.roles).toContain("server-component");
  });
});
