import { createRequire } from "node:module";
import { getRequestContext } from "../hooks/context.js";

const appRequire = createRequire(process.cwd() + "/index.js");

export function tryRequire(id: string): unknown {
  try {
    return appRequire(id);
  } catch {
    return null;
  }
}

/**
 * Capture the current request ID eagerly before async DB operations.
 * Driver internals can break AsyncLocalStorage propagation.
 */
export function captureRequestId(): string | null {
  return getRequestContext()?.requestId ?? null;
}
