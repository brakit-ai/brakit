import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
