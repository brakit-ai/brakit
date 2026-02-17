import { send } from "../transport.js";
import { getRequestContext } from "./context.js";

function captureError(err: unknown): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const ctx = getRequestContext();
  send({
    type: "error",
    data: {
      name: error.name,
      message: error.message,
      stack: error.stack ?? "",
      parentRequestId: ctx?.requestId ?? null,
      timestamp: Date.now(),
    },
  });
}

export function setupErrorHook(): void {
  process.on("uncaughtException", (err) => {
    captureError(err);
    // Re-throw so Node.js default behavior (crash) is preserved
    // The listener is removed temporarily to avoid infinite loop
    process.removeAllListeners("uncaughtException");
    throw err;
  });

  process.on("unhandledRejection", (reason) => {
    captureError(reason);
  });
}
