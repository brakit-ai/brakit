import { createRequire } from "node:module";
import { send } from "../../transport.js";
import { getRequestContext } from "../context.js";

// Resolve modules from the target app's node_modules, not brakit's.
// The preload runs inside the app process, but import() resolves relative
// to brakit's dist/ directory. createRequire uses the app's CWD instead.
const appRequire = createRequire(process.cwd() + "/index.js");

export function tryRequire(id: string): unknown {
  try {
    return appRequire(id);
  } catch {
    return null;
  }
}

export interface QueryData {
  driver: string;
  sql?: string;
  model?: string;
  operation?: string;
  durationMs: number;
  rowCount?: number;
}

export function sendQuery(data: QueryData): void {
  const ctx = getRequestContext();
  send({
    type: "query",
    data: {
      ...data,
      durationMs: Math.round(data.durationMs),
      parentRequestId: ctx?.requestId ?? null,
      timestamp: Date.now(),
    },
  });
}
