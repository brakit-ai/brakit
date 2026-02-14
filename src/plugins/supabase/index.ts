import type { BrakitPlugin } from "../../core/plugin/types.js";

export function supabase(): BrakitPlugin {
  return {
    name: "supabase",
    version: "0.1.0",
  };
}
