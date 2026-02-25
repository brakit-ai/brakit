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
  const shouldCaptureBody = method !== "GET" && method !== "HEAD";

  const reqChunks: Buffer[] = [];
  let reqSize = 0;

  if (shouldCaptureBody) {
    req.on("data", (chunk: Buffer) => {
      if (reqSize < DEFAULT_MAX_BODY_CAPTURE) {
        reqChunks.push(chunk);
        reqSize += chunk.length;
      }
    });
  }

  const resChunks: Buffer[] = [];
  let resSize = 0;
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (
    this: ServerResponse,
    chunk: unknown,
    ...args: unknown[]
  ): boolean {
    if (chunk && resSize < DEFAULT_MAX_BODY_CAPTURE) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      resChunks.push(buf);
      resSize += buf.length;
    }
    return (originalWrite as Function).apply(this, [chunk, ...args]);
  } as typeof res.write;

  res.end = function (
    this: ServerResponse,
    ...args: unknown[]
  ): ServerResponse {
    const chunk = typeof args[0] !== "function" ? args[0] : undefined;
    if (chunk && resSize < DEFAULT_MAX_BODY_CAPTURE) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      resChunks.push(buf);
    }
    const result = (originalEnd as Function).apply(this, args);

    defaultStore.capture({
      requestId,
      method,
      url: req.url ?? "/",
      requestHeaders: req.headers,
      requestBody: reqChunks.length > 0 ? Buffer.concat(reqChunks) : null,
      statusCode: res.statusCode,
      responseHeaders: outgoingToIncoming(res.getHeaders()),
      responseBody: resChunks.length > 0 ? Buffer.concat(resChunks) : null,
      responseContentType: String(res.getHeader("content-type") ?? ""),
      startTime,
      config: { maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE },
    });

    return result;
  } as typeof res.end;
}
