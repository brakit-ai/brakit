import type { BrakitPlugin } from "../../core/plugin/types.js";

export function prisma(): BrakitPlugin {
  return {
    name: "prisma",
    version: "0.1.0",
  };
}
