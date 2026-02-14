import type { ProjectContext } from "../../core/types/context.js";
import type { BrakitPlugin } from "../../core/plugin/types.js";

export function compounds(_context?: ProjectContext): BrakitPlugin {
  return {
    name: "compounds",
    version: "0.1.0",
  };
}
