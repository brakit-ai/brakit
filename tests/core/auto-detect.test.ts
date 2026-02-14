import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  detectProjectContext,
  detectPlugins,
} from "@/core/plugin/auto-detect";

const FIXTURES = join(__dirname, "../fixtures");

describe("detectProjectContext", () => {
  it("detects a full Next.js + Prisma + Auth + Supabase project", async () => {
    const ctx = await detectProjectContext(join(FIXTURES, "nextjs-app"));

    expect(ctx.framework?.name).toBe("nextjs");
    expect(ctx.framework?.version).toBe("14.0.0");
    expect(ctx.framework?.details.router).toBe("app");
    expect(ctx.framework?.details.hasAppDir).toBe(true);

    expect(ctx.orm?.name).toBe("prisma");
    expect(ctx.auth?.name).toBe("next-auth");
    expect(ctx.baas?.name).toBe("supabase");

    expect(ctx.typescript).toBe(true);
    expect(ctx.packageManager).toBe("npm");
  });

  it("returns empty context for directory without package.json", async () => {
    const ctx = await detectProjectContext("/nonexistent-dir-12345");

    expect(ctx.framework).toBeNull();
    expect(ctx.orm).toBeNull();
    expect(ctx.auth).toBeNull();
    expect(ctx.baas).toBeNull();
    expect(ctx.packageManager).toBe("unknown");
    expect(ctx.typescript).toBe(false);
  });

  it("detects minimal project with only next", async () => {
    const ctx = await detectProjectContext(join(FIXTURES, "minimal-next"));

    expect(ctx.framework?.name).toBe("nextjs");
    expect(ctx.framework?.details.router).toBe("unknown");
    expect(ctx.orm).toBeNull();
    expect(ctx.auth).toBeNull();
    expect(ctx.baas).toBeNull();
  });
});

describe("detectPlugins", () => {
  it("loads plugins for detected dependencies", async () => {
    const ctx = await detectProjectContext(join(FIXTURES, "nextjs-app"));
    const plugins = await detectPlugins(ctx);

    const names = plugins.map((p) => p.name);

    expect(names).toContain("nextjs");
    expect(names).toContain("prisma");
    expect(names).toContain("auth");
    expect(names).toContain("supabase");
    expect(names).toContain("compounds");
  });

  it("always includes compounds plugin even with no deps", async () => {
    const ctx = await detectProjectContext(join(FIXTURES, "minimal-next"));
    const plugins = await detectPlugins(ctx);

    const names = plugins.map((p) => p.name);
    expect(names).toContain("compounds");
  });

  it("deduplicates plugins when multiple deps map to the same one", async () => {
    const ctx = await detectProjectContext(join(FIXTURES, "nextjs-app"));
    const plugins = await detectPlugins(ctx);

    // Both "prisma" and "@prisma/client" map to the prisma plugin.
    const prismaCount = plugins.filter((p) => p.name === "prisma").length;
    expect(prismaCount).toBe(1);
  });
});
