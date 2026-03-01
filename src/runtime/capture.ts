/**
 * Response capture — monkeypatches `res.write()` and `res.end()` to collect
 * response body chunks in a buffer, then records the complete request/response
 * pair when the response finishes.
 *
 * Safety guarantees:
 * - Every catch block is intentionally silent — capture failures must never
 *   prevent the original response from being sent.
 * - Body capture is bounded by DEFAULT_MAX_BODY_CAPTURE to prevent memory issues.
 * - Compressed responses (gzip/br/deflate) are decompressed for readable storage.
 */
import type {
  IncomingMessage,
  ServerResponse,
  OutgoingHttpHeaders,
} from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { gunzipSync, brotliDecompressSync, inflateSync } from "node:zlib";
import type { RequestStoreInterface } from "../types/services.js";
import {
  DEFAULT_MAX_BODY_CAPTURE,
  CONTENT_ENCODING_GZIP,
  CONTENT_ENCODING_BR,
  CONTENT_ENCODING_DEFLATE,
} from "../constants/index.js";
import { brakitDebug } from "../utils/log.js";

type WriteFn = ServerResponse["write"];
type EndFn = ServerResponse["end"];

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
    if (encoding === CONTENT_ENCODING_GZIP) return gunzipSync(body);
    if (encoding === CONTENT_ENCODING_BR) return brotliDecompressSync(body);
    if (encoding === CONTENT_ENCODING_DEFLATE) return inflateSync(body);
  } catch (e) {
    brakitDebug(`decompress failed: ${(e as Error).message}`);
  }
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
  requestStore: RequestStoreInterface,
): void {
  const startTime = performance.now();
  const method = req.method ?? "GET";

  const resChunks: Buffer[] = [];
  let resSize = 0;
  const originalWrite: WriteFn = res.write;
  const originalEnd: EndFn = res.end;

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
    } catch (e) {
      brakitDebug(`capture write: ${(e as Error).message}`);
    }
    return (originalWrite as WriteFn).apply(this, args as Parameters<WriteFn>);
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
    } catch (e) {
      brakitDebug(`capture end: ${(e as Error).message}`);
    }

    const result = (originalEnd as EndFn).apply(this, args as Parameters<EndFn>);
    const endTime = performance.now();

    try {
      const encoding = String(res.getHeader("content-encoding") ?? "").toLowerCase();
      let body = resChunks.length > 0 ? Buffer.concat(resChunks) : null;
      if (body && encoding) {
        body = decompress(body, encoding);
      }

      requestStore.capture({
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
    } catch (e) {
      brakitDebug(`capture store: ${(e as Error).message}`);
    }

    return result;
  } as typeof res.end;
}
