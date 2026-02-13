import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bin/brakit": "bin/brakit.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  banner: {
    js: "",
  },
  onSuccess: async () => {
    const { readFileSync, writeFileSync } = await import("fs");
    const binPath = "dist/bin/brakit.js";
    try {
      const content = readFileSync(binPath, "utf-8");
      if (!content.startsWith("#!/")) {
        writeFileSync(binPath, `#!/usr/bin/env node\n${content}`);
      }
    } catch {
      // File may not exist during first build
    }
  },
});
