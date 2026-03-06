import { describe, it, expect } from "vitest";
import { isExactBrakitTemplate, BRAKIT_TEMPLATES } from "../../src/cli/templates.js";

describe("isExactBrakitTemplate", () => {
  it("matches the Next.js template exactly", () => {
    expect(isExactBrakitTemplate(BRAKIT_TEMPLATES.nextjs)).toBe(true);
  });

  it("matches the Next.js template with trailing newline", () => {
    expect(isExactBrakitTemplate(BRAKIT_TEMPLATES.nextjs + "\n")).toBe(true);
  });

  it("matches the Next.js template with extra indentation", () => {
    const withSpaces = BRAKIT_TEMPLATES.nextjs
      .split("\n")
      .map((l) => "  " + l + "  ")
      .join("\n");
    expect(isExactBrakitTemplate(withSpaces)).toBe(true);
  });

  it("matches the Nuxt template exactly", () => {
    expect(isExactBrakitTemplate(BRAKIT_TEMPLATES.nuxt)).toBe(true);
  });

  it("matches the Nuxt template with trailing newline", () => {
    expect(isExactBrakitTemplate(BRAKIT_TEMPLATES.nuxt + "\n")).toBe(true);
  });

  it("does not match a file with Sentry + brakit mixed", () => {
    const mixed = [
      `export async function register() {`,
      `  if (process.env.NODE_ENV !== "production") {`,
      `    try { await import("@sentry/node"); } catch {}`,
      `    try { await import("brakit"); } catch {}`,
      `  }`,
      `}`,
    ].join("\n");
    expect(isExactBrakitTemplate(mixed)).toBe(false);
  });

  it("does not match an OpenTelemetry instrumentation file", () => {
    const otel = [
      `import { NodeSDK } from "@opentelemetry/sdk-node";`,
      `export async function register() {`,
      `  const sdk = new NodeSDK();`,
      `  sdk.start();`,
      `}`,
    ].join("\n");
    expect(isExactBrakitTemplate(otel)).toBe(false);
  });

  it("does not match an empty file", () => {
    expect(isExactBrakitTemplate("")).toBe(false);
  });

  it("does not match a file with brakit import + extra code", () => {
    const extra = `import "brakit";\nconsole.log("hello");`;
    expect(isExactBrakitTemplate(extra)).toBe(false);
  });

  it("does not match brakit template with a no-op addition", () => {
    const withNoOp = [
      `export async function register() {`,
      `  if (process.env.NODE_ENV !== "production") {`,
      `    try { await import("brakit"); } catch {}`,
      `  }`,
      `}`,
      ``,
      `// no-op`,
    ].join("\n");
    expect(isExactBrakitTemplate(withNoOp)).toBe(false);
  });

  it("does not match brakit template with additional register logic", () => {
    const withExtra = [
      `export async function register() {`,
      `  if (process.env.NODE_ENV !== "production") {`,
      `    try { await import("brakit"); } catch {}`,
      `  }`,
      `  console.log("registered");`,
      `}`,
    ].join("\n");
    expect(isExactBrakitTemplate(withExtra)).toBe(false);
  });
});
