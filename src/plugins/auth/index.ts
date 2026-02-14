import type { BrakitPlugin } from "../../core/plugin/types.js";

export function auth(): BrakitPlugin {
  return {
    name: "auth",
    version: "0.1.0",
  };
}
