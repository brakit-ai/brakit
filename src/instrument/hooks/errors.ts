import type { TelemetryEvent } from "../../types/index.js";
import { getRequestContext } from "./context.js";

function createCaptureError(emit: (event: TelemetryEvent) => void) {
  return (err: unknown): void => {
    const error = err instanceof Error ? err : new Error(String(err));
    const ctx = getRequestContext();
    emit({
      type: "error",
      data: {
        name: error.name,
        message: error.message,
        stack: error.stack ?? "",
        parentRequestId: ctx?.requestId ?? null,
        timestamp: Date.now(),
      },
    });
  };
}

export function setupErrorHook(emit: (event: TelemetryEvent) => void): void {
  const captureError = createCaptureError(emit);

  process.on("uncaughtException", (err) => {
    captureError(err);
    process.removeAllListeners("uncaughtException");
    throw err;
  });

  process.on("unhandledRejection", (reason) => {
    captureError(reason);
  });
}
