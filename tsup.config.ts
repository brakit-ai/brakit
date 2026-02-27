import { defineConfig } from "tsup";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig({
  entry: {
    api: "src/index.ts",
    "bin/brakit": "bin/brakit.ts",
    "runtime/index": "src/runtime/index.ts",
    "mcp/server": "src/mcp/server.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  external: ["pg", "mysql2", "@prisma/client", "@modelcontextprotocol/sdk"],
  define: {
    "process.env.BRAKIT_VERSION": JSON.stringify(pkg.version),
    "process.env.POSTHOG_API_KEY": JSON.stringify(
      process.env.POSTHOG_API_KEY ?? "",
    ),
  },
  banner: {
    js: "",
  },
  onSuccess: async () => {
    const { readFileSync, writeFileSync, chmodSync } = await import("fs");
    const binPath = "dist/bin/brakit.js";
    try {
      const content = readFileSync(binPath, "utf-8");
      if (!content.startsWith("#!/")) {
        writeFileSync(binPath, `#!/usr/bin/env node\n${content}`);
      }
      chmodSync(binPath, 0o755);
    } catch {
      // File may not exist during first build
    }
  },
});
