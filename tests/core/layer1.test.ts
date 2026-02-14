import { describe, it, expect } from "vitest";
import { RegistryBuilder } from "@/core/plugin/registry";
import { runLayer2 } from "@/core/layers/layer2-ast/index";
import { runLayer1 } from "@/core/layers/layer1-static/index";
import { deduplicateFindings } from "@/core/layers/layer1-static/deduplicator";
import { nextjs } from "@/plugins/nextjs/index";
import { prisma } from "@/plugins/prisma/index";
import { supabase } from "@/plugins/supabase/index";
import { auth } from "@/plugins/auth/index";
import type { ScanInput } from "@/core/pipeline/types";
import type { Finding } from "@/core/types/findings";

// ── Helpers ──

function buildFullRegistry() {
  return new RegistryBuilder()
    .addPlugin(nextjs())
    .addPlugin(prisma())
    .addPlugin(supabase())
    .addPlugin(auth())
    .resolve();
}

const BASE_CONFIG: ScanInput["config"] = {
  minSeverity: "low",
  exclude: [],
  pluginOptions: {},
  scoreThreshold: 0,
};

const BASE_CONTEXT: ScanInput["projectContext"] = {
  rootDir: "/test",
  framework: { name: "nextjs", version: "14.0.0", details: {} },
  orm: { name: "prisma", version: "5.0.0", details: {} },
  auth: null,
  baas: null,
  packageManager: "npm",
  typescript: true,
  dependencies: {},
  devDependencies: {},
};

function scan(files: Record<string, string>) {
  const registry = buildFullRegistry();
  const fileContents = new Map(Object.entries(files));
  const input: ScanInput = {
    rootDir: "/test",
    filePaths: [...fileContents.keys()],
    fileContents,
    config: BASE_CONFIG,
    projectContext: BASE_CONTEXT,
  };
  const layer2 = runLayer2(input, registry);
  return runLayer1(layer2, registry);
}

// ── Next.js pattern tests ──

describe("nextjs patterns", () => {
  it("flags unprotected API route", () => {
    const result = scan({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ users: [] });
}
`,
    });
    const finding = result.findings.find(
      (f) => f.patternId === "nextjs:unprotected-route",
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("high");
  });

  it("does NOT flag protected API route", () => {
    const result = scan({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ users: [] });
}
`,
    });
    const finding = result.findings.find(
      (f) => f.patternId === "nextjs:unprotected-route",
    );
    expect(finding).toBeUndefined();
  });

  it("flags unvalidated input", () => {
    const result = scan({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(body);
}
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "nextjs:unvalidated-input"),
    ).toBe(true);
  });

  it("does NOT flag validated input", () => {
    const result = scan({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
import { z } from "zod";
export async function POST(request: Request) {
  const body = z.object({ name: z.string() }).parse(await request.json());
  return NextResponse.json(body);
}
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "nextjs:unvalidated-input"),
    ).toBe(false);
  });

  it("flags dangerouslySetInnerHTML with line number", () => {
    const result = scan({
      "components/html.tsx": `
export default function RawHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
`,
    });
    const finding = result.findings.find(
      (f) => f.patternId === "nextjs:dangerous-html",
    );
    expect(finding).toBeDefined();
    expect(finding!.confidence).toBe("certain");
    expect(finding!.line).toBeGreaterThan(0);
  });

  it("flags missing 'use client' directive", () => {
    const result = scan({
      "components/counter.tsx": `
import { useState } from "react";
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "nextjs:missing-use-client",
      ),
    ).toBe(true);
  });

  it("does NOT flag when 'use client' is present", () => {
    const result = scan({
      "components/counter.tsx": `"use client";
import { useState } from "react";
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button>{count}</button>;
}
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "nextjs:missing-use-client",
      ),
    ).toBe(false);
  });

  it("flags server import in client component", () => {
    const result = scan({
      "components/bad.tsx": `"use client";
import { PrismaClient } from "@prisma/client";
export default function Bad() { return <div />; }
`,
    });
    const finding = result.findings.find(
      (f) => f.patternId === "nextjs:server-import-in-client",
    );
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
  });

  it("flags exposed env with sensitive name", () => {
    const result = scan({
      "lib/config.ts": `
export const apiKey = process.env.NEXT_PUBLIC_SECRET_KEY;
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "nextjs:exposed-env"),
    ).toBe(true);
  });

  it("flags no error handling in async API route", () => {
    const result = scan({
      "app/api/data/route.ts": `
import { NextResponse } from "next/server";
export async function GET() {
  const data = await fetch("https://api.example.com/data");
  return NextResponse.json(await data.json());
}
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "nextjs:no-error-handling",
      ),
    ).toBe(true);
  });

  it("does NOT flag when try/catch is present", () => {
    const result = scan({
      "app/api/data/route.ts": `
import { NextResponse } from "next/server";
export async function GET() {
  try {
    const data = await fetch("https://api.example.com/data");
    return NextResponse.json(await data.json());
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "nextjs:no-error-handling",
      ),
    ).toBe(false);
  });
});

// ── Prisma pattern tests ──

describe("prisma patterns", () => {
  it("flags raw query usage", () => {
    const result = scan({
      "lib/db.ts": `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export async function search(term: string) {
  return prisma.$queryRaw\`SELECT * FROM users WHERE name = \${term}\`;
}
`,
    });
    const finding = result.findings.find(
      (f) => f.patternId === "prisma:raw-query",
    );
    expect(finding).toBeDefined();
    expect(finding!.confidence).toBe("certain");
    expect(finding!.line).toBeGreaterThan(0);
  });

  it("flags findMany without pagination", () => {
    const result = scan({
      "lib/db.ts": `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export async function getUsers() {
  return prisma.user.findMany();
}
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "prisma:no-pagination"),
    ).toBe(true);
  });

  it("does NOT flag findMany with pagination", () => {
    const result = scan({
      "lib/db.ts": `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export async function getUsers(page: number) {
  return prisma.user.findMany({ take: 20, skip: page * 20 });
}
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "prisma:no-pagination"),
    ).toBe(false);
  });

  it("flags query without select clause", () => {
    const result = scan({
      "lib/db.ts": `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export async function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "prisma:select-all"),
    ).toBe(true);
  });
});

// ── Supabase pattern tests ──

describe("supabase patterns", () => {
  it("flags service role key in source", () => {
    const result = scan({
      "lib/supabase.ts": `
import { createClient } from "@supabase/supabase-js";
export const admin = createClient(url, service_role);
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "supabase:service-role-client",
      ),
    ).toBe(true);
  });
});

// ── Auth pattern tests ──

describe("auth patterns", () => {
  it("flags hardcoded secret", () => {
    const result = scan({
      "lib/auth.ts": `
const jwt_secret = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghij";
`,
    });
    expect(
      result.findings.some((f) => f.patternId === "auth:hardcoded-secret"),
    ).toBe(true);
  });

  it("flags API route without session check", () => {
    const result = scan({
      "app/api/admin/route.ts": `
import { NextResponse } from "next/server";
export async function DELETE() {
  return NextResponse.json({ deleted: true });
}
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "auth:missing-session-check",
      ),
    ).toBe(true);
  });

  it("does NOT flag route with session check", () => {
    const result = scan({
      "app/api/admin/route.ts": `
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
export async function DELETE() {
  const session = await getServerSession();
  return NextResponse.json({ deleted: true });
}
`,
    });
    expect(
      result.findings.some(
        (f) => f.patternId === "auth:missing-session-check",
      ),
    ).toBe(false);
  });
});

// ── Deduplicator tests ──

describe("deduplicateFindings", () => {
  it("removes duplicate findings on same line", () => {
    const findings: Finding[] = [
      {
        id: "a:0",
        patternId: "nextjs:dangerous-html",
        source: "nextjs",
        pillar: "security",
        severity: "high",
        confidence: "firm",
        title: "test",
        message: "test",
        filePath: "a.tsx",
        line: 5,
        metadata: {},
      },
      {
        id: "a:1",
        patternId: "nextjs:dangerous-html",
        source: "nextjs",
        pillar: "security",
        severity: "high",
        confidence: "certain",
        title: "test",
        message: "test",
        filePath: "a.tsx",
        line: 5,
        metadata: {},
      },
    ];

    const deduped = deduplicateFindings(findings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].confidence).toBe("certain");
  });

  it("keeps findings from different patterns on same line", () => {
    const findings: Finding[] = [
      {
        id: "a:0",
        patternId: "nextjs:unprotected-route",
        source: "nextjs",
        pillar: "security",
        severity: "high",
        confidence: "firm",
        title: "test",
        message: "test",
        filePath: "route.ts",
        line: 1,
        metadata: {},
      },
      {
        id: "b:0",
        patternId: "auth:missing-session-check",
        source: "auth",
        pillar: "security",
        severity: "high",
        confidence: "firm",
        title: "test",
        message: "test",
        filePath: "route.ts",
        line: 1,
        metadata: {},
      },
    ];

    const deduped = deduplicateFindings(findings);
    expect(deduped).toHaveLength(2);
  });
});

// ── Full Layer 1 integration ──

describe("runLayer1 integration", () => {
  it("detects multiple vulnerabilities across plugins", () => {
    const result = scan({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}
`,
    });

    const patternIds = result.findings.map((f) => f.patternId);

    expect(patternIds).toContain("nextjs:unprotected-route");
    expect(patternIds).toContain("prisma:no-pagination");
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
  });

  it("produces zero findings for safe code", () => {
    const result = scan({
      "lib/utils.ts": `
export function formatDate(date: Date): string {
  return date.toISOString();
}
`,
    });

    expect(result.findings).toHaveLength(0);
  });
});
