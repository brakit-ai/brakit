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
import { gunzip, brotliDecompress, inflate } from "node:zlib";
import type { RequestStoreInterface } from "../types/services.js";
import {
  DEFAULT_MAX_BODY_CAPTURE,
  CONTENT_ENCODING_GZIP,
  CONTENT_ENCODING_BR,
  CONTENT_ENCODING_DEFLATE,
} from "../constants/index.js";
import { brakitDebug } from "../utils/log.js";
import { getErrorMessage } from "../utils/type-guards.js";

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

function decompressAsync(body: Buffer<ArrayBuffer>, encoding: string): Promise<Buffer<ArrayBuffer>> {
  const decompressor =
    encoding === CONTENT_ENCODING_GZIP ? gunzip :
    encoding === CONTENT_ENCODING_BR ? brotliDecompress :
    encoding === CONTENT_ENCODING_DEFLATE ? inflate :
    null;

  if (!decompressor) return Promise.resolve(body);

  return new Promise((resolve) => {
    decompressor(body, (err, result) => {
      resolve(err ? body : result);
    });
  });
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

  let truncated = false;

  res.write = function (this: ServerResponse, ...args: unknown[]): boolean {
    try {
      const chunk = args[0];
      if (chunk != null && typeof chunk !== "function") {
        if (resSize < DEFAULT_MAX_BODY_CAPTURE) {
          const buf = toBuffer(chunk);
          if (buf) {
            resChunks.push(buf);
            resSize += buf.length;
          }
        } else {
          truncated = true;
        }
      }
    } catch (e) {
      brakitDebug(`capture write: ${getErrorMessage(e)}`);
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
      brakitDebug(`capture end: ${getErrorMessage(e)}`);
    }

    const result = (originalEnd as EndFn).apply(this, args as Parameters<EndFn>);
    const endTime = performance.now();

    // Snapshot headers synchronously before they can change, then
    // defer decompression + store capture off the critical path.
    const encoding = String(res.getHeader("content-encoding") ?? "").toLowerCase();
    const statusCode = res.statusCode;
    const responseHeaders = outgoingToIncoming(res.getHeaders());
    const responseContentType = String(res.getHeader("content-type") ?? "");

    const capturedChunks = resChunks.slice();
    void (async () => {
      try {
        let body = capturedChunks.length > 0 ? Buffer.concat(capturedChunks) : null;
        if (body && encoding && !truncated) {
          body = await decompressAsync(body, encoding);
        }

        requestStore.capture({
          requestId,
          method,
          url: req.url ?? "/",
          requestHeaders: req.headers,
          requestBody: null,
          statusCode,
          responseHeaders,
          responseBody: body,
          responseContentType,
          startTime,
          endTime,
          config: { maxBodyCapture: DEFAULT_MAX_BODY_CAPTURE },
        });
      } catch (e) {
        brakitDebug(`capture store: ${getErrorMessage(e)}`);
      }
    })();

    return result;
  } as typeof res.end;
}
