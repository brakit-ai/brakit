import type {
  IncomingMessage,
  ServerResponse,
  OutgoingHttpHeaders,
} from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { defaultStore } from "../store/request-log.js";
import { DEFAULT_MAX_BODY_CAPTURE } from "../constants/index.js";

function outgoingToIncoming(headers: OutgoingHttpHeaders): IncomingHttpHeaders {
  const result: IncomingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value.map(String);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

export function captureInProcess(
  req: IncomingMessage,
  res: ServerResponse,
  requestId: string,
): void {
  const startTime = performance.now();
  const method = req.method ?? "GET";

  const resChunks: Buffer[] = [];
  let resSize = 0;
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (this: ServerResponse, ...args: unknown[]): boolean {
    try {
      const chunk = args[0];
      if (chunk != null && typeof chunk !== "function" && resSize < DEFAULT_MAX_BODY_CAPTURE) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        resChunks.push(buf);
        resSize += buf.length;
      }
    } catch {
      // Never interfere with the response
    }
    return (originalWrite as Function).apply(this, args);
  } as typeof res.write;

  res.end = function (this: ServerResponse, ...args: unknown[]): ServerResponse {
    try {
      const chunk = typeof args[0] !== "function" ? args[0] : undefined;
      if (chunk != null && resSize < DEFAULT_MAX_BODY_CAPTURE) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        resChunks.push(buf);
      }
    } catch {
      // Never interfere with the response
    }

    const result = (originalEnd as Function).apply(this, args);

    try {
      defaultStore.capture({
        requestId,
        method,
        url: req.url ?? "/",
        requestHeaders: req.headers,
        requestBody: null,
        statusCode: res.statusCode,
        responseHeaders: outgoingToIncoming(res.getHeaders()),
        responseBody: resChunks.length > 0 ? Buffer.concat(resChunks) : null,
        responseContentType: String(res.getHeader("content-type") ?? ""),
        startTime,
        config: { maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE },
      });
    } catch {
      // Capture failure should never affect the app
    }

    return result;
  } as typeof res.end;
}
