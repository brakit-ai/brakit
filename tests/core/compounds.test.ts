import { describe, it, expect } from "vitest";
import { RegistryBuilder } from "@/core/plugin/registry";
import { runParser } from "@/core/stages/parse/index";
import { runAnalyzer } from "@/core/stages/analyze/index";
import { runCorrelator } from "@/core/stages/correlate/index";
import { nextjs } from "@/plugins/nextjs/index";
import { prisma } from "@/plugins/prisma/index";
import { supabase } from "@/plugins/supabase/index";
import { auth } from "@/plugins/auth/index";
import { compounds } from "@/plugins/compounds/index";
import type { ScanInput } from "@/core/pipeline/types";

// ── Helpers ──

function buildFullRegistry() {
  return new RegistryBuilder()
    .addPlugin(nextjs())
    .addPlugin(prisma())
    .addPlugin(supabase())
    .addPlugin(auth())
    .addPlugin(compounds())
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

function correlate(files: Record<string, string>) {
  const registry = buildFullRegistry();
  const fileContents = new Map(Object.entries(files));
  const input: ScanInput = {
    rootDir: "/test",
    filePaths: [...fileContents.keys()],
    fileContents,
    config: BASE_CONFIG,
    projectContext: BASE_CONTEXT,
  };
  const parsed = runParser(input, registry);
  const analyzed = runAnalyzer(parsed, registry);
  return runCorrelator(analyzed, registry);
}

// ── Compound Rule Tests ──

describe("unprotected-raw-query", () => {
  it("detects same-file unprotected route with raw query", () => {
    const result = correlate({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const users = await prisma.$queryRaw\`SELECT * FROM users\`;
  return NextResponse.json(users);
}
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:unprotected-raw-query",
    );
    expect(compound).toBeDefined();
    expect(compound!.severity).toBe("critical");
    expect(compound!.confidence).toBe("certain");
  });

  it("detects cross-file unprotected route importing raw query module", () => {
    const result = correlate({
      "/test/app/api/users/route.ts": `
import { NextResponse } from "next/server";
import { getUsers } from "../../../lib/db";

export async function GET() {
  const users = await getUsers();
  return NextResponse.json(users);
}
`,
      "/test/lib/db.ts": `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getUsers() {
  return prisma.$queryRaw\`SELECT * FROM users\`;
}
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:unprotected-raw-query",
    );
    expect(compound).toBeDefined();
    expect(compound!.confidence).toBe("firm");
  });

  it("does not fire when route is unrelated to raw query file", () => {
    const result = correlate({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
`,
      "scripts/migrate.ts": `
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.$queryRaw\`SELECT 1\`;
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:unprotected-raw-query",
    );
    expect(compound).toBeUndefined();
  });
});

describe("unvalidated-db-write", () => {
  it("detects unvalidated input flowing to raw query in same file", () => {
    const result = correlate({
      "app/api/users/route.ts": `
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const body = await request.json();
  await prisma.$executeRaw\`INSERT INTO users (name) VALUES (\${body.name})\`;
  return NextResponse.json({ ok: true });
}
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:unvalidated-db-write",
    );
    expect(compound).toBeDefined();
    expect(compound!.severity).toBe("critical");
  });
});

describe("unprotected-no-rls", () => {
  it("detects unprotected route with RLS disabled on Supabase client", () => {
    const result = correlate({
      "app/api/data/route.ts": `
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.URL!, process.env.KEY!);

export async function GET() {
  const { data } = await supabase.from("users").select("*");
  return NextResponse.json(data);
}
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:unprotected-no-rls",
    );
    expect(compound).toBeDefined();
    expect(compound!.severity).toBe("high");
  });
});

describe("no-auth-db-access", () => {
  it("detects missing session check with unscoped select in same file", () => {
    const result = correlate({
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

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:no-auth-db-access",
    );
    expect(compound).toBeDefined();
    expect(compound!.severity).toBe("high");
  });
});

describe("exposed-service-key", () => {
  it("escalates service-role key usage as standalone compound", () => {
    const result = correlate({
      "lib/supabase-admin.ts": `
import { createClient } from "@supabase/supabase-js";

export const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:exposed-service-key",
    );
    expect(compound).toBeDefined();
    expect(compound!.severity).toBe("critical");
  });

  it("does not fire when no service-role key is used", () => {
    const result = correlate({
      "lib/supabase.ts": `
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
`,
    });

    const compound = result.compoundFindings.find(
      (cf) => cf.ruleId === "compounds:exposed-service-key",
    );
    expect(compound).toBeUndefined();
  });
});
