import { format } from "node:util";
import { send } from "../transport.js";
import { getRequestContext } from "./context.js";

type LogLevel = "log" | "warn" | "error" | "info" | "debug";

const LEVELS: LogLevel[] = ["log", "warn", "error", "info", "debug"];

const originals: Record<LogLevel, (...args: unknown[]) => void> = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

export function setupConsoleHook(): void {
  for (const level of LEVELS) {
    const original = originals[level];
    console[level] = (...args: unknown[]) => {
      original.apply(console, args);

      const ctx = getRequestContext();
      const message = format(...args);
      const timestamp = Date.now();
      const parentRequestId = ctx?.requestId ?? null;

      // When console.error is called, check if it's an actual error
      // (thrown + caught by framework). Route to Errors tab instead of Logs.
      if (level === "error") {
        const errorArg = args.find((a) => a instanceof Error) as
          | Error
          | undefined;
        if (errorArg) {
          send({
            type: "error",
            data: {
              name: errorArg.name,
              message: errorArg.message,
              stack: errorArg.stack ?? "",
              parentRequestId,
              timestamp,
            },
          });
          return;
        }

        // Detect formatted error strings (e.g. "⨯ Error: message ...")
        const match = message.match(/(\w*Error):\s+(.+)/s);
        if (match) {
          send({
            type: "error",
            data: {
              name: match[1],
              message: match[2].split("\n")[0],
              stack: message,
              parentRequestId,
              timestamp,
            },
          });
          return;
        }
      }

      send({
        type: "log",
        data: { level, message, parentRequestId, timestamp },
      });
    };
  }
}
