import type {
  IncomingMessage,
  ServerResponse,
  OutgoingHttpHeaders,
} from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { gunzipSync, brotliDecompressSync, inflateSync } from "node:zlib";
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

function decompress(body: Buffer<ArrayBuffer>, encoding: string): Buffer<ArrayBuffer> {
  try {
    if (encoding === "gzip") return gunzipSync(body);
    if (encoding === "br") return brotliDecompressSync(body);
    if (encoding === "deflate") return inflateSync(body);
  } catch {}
  return body;
}

function toBuffer(chunk: unknown): Buffer | null {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if (typeof chunk === "string") return Buffer.from(chunk);
  return null;
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
        const buf = toBuffer(chunk);
        if (buf) {
          resChunks.push(buf);
          resSize += buf.length;
        }
      }
    } catch {}
    return (originalWrite as Function).apply(this, args);
  } as typeof res.write;

  res.end = function (this: ServerResponse, ...args: unknown[]): ServerResponse {
    try {
      const chunk = typeof args[0] !== "function" ? args[0] : undefined;
      if (chunk != null && resSize < DEFAULT_MAX_BODY_CAPTURE) {
        const buf = toBuffer(chunk);
        if (buf) {
          resChunks.push(buf);
        }
      }
    } catch {}

    const result = (originalEnd as Function).apply(this, args);
    const endTime = performance.now();

    try {
      const encoding = String(res.getHeader("content-encoding") ?? "").toLowerCase();
      let body = resChunks.length > 0 ? Buffer.concat(resChunks) : null;
      if (body && encoding) {
        body = decompress(body, encoding);
      }

      defaultStore.capture({
        requestId,
        method,
        url: req.url ?? "/",
        requestHeaders: req.headers,
        requestBody: null,
        statusCode: res.statusCode,
        responseHeaders: outgoingToIncoming(res.getHeaders()),
        responseBody: body,
        responseContentType: String(res.getHeader("content-type") ?? ""),
        startTime,
        endTime,
        config: { maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE },
      });
    } catch {}

    return result;
  } as typeof res.end;
}
