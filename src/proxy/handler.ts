import {
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import type { BrakitConfig } from "../types/index.js";
import { captureRequest } from "./request-log.js";
import { BRAKIT_REQUEST_ID_HEADER } from "../constants.js";

export function proxyRequest(
  clientReq: IncomingMessage,
  clientRes: ServerResponse,
  config: BrakitConfig,
): void {
  const startTime = performance.now();
  const method = clientReq.method ?? "GET";
  const requestId = randomUUID();

  const shouldCaptureBody = method !== "GET" && method !== "HEAD";
  const bodyChunks: Buffer[] = [];
  let bodySize = 0;

  if (shouldCaptureBody) {
    clientReq.on("data", (chunk: Buffer) => {
      if (bodySize < config.maxBodyCapture) {
        bodyChunks.push(chunk);
        bodySize += chunk.length;
      }
    });
  }

  // Keep original Host so Next.js Server Actions origin check passes
  const proxyHeaders = { ...clientReq.headers };
  proxyHeaders["accept-encoding"] = "identity";
  proxyHeaders[BRAKIT_REQUEST_ID_HEADER] = requestId;

  const proxyReq = httpRequest(
    {
      hostname: "127.0.0.1",
      port: config.targetPort,
      path: clientReq.url,
      method,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      handleProxyResponse(
        clientReq,
        clientRes,
        proxyRes,
        startTime,
        shouldCaptureBody ? bodyChunks : [],
        config,
        requestId,
      );
    },
  );

  proxyReq.on("error", (err) => {
    if (clientRes.headersSent) return;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ECONNREFUSED" || code === "ECONNRESET") {
      clientRes.writeHead(502, { "content-type": "text/html" });
      clientRes.end(
        `<html><body style="font-family:system-ui;padding:40px;text-align:center">` +
          `<h2>brakit</h2>` +
          `<p>Waiting for dev server on port ${config.targetPort}...</p>` +
          `<script>setTimeout(()=>location.reload(),2000)</script>` +
          `</body></html>`,
      );
    } else {
      clientRes.writeHead(502, { "content-type": "text/plain" });
      clientRes.end(`brakit proxy error: ${err.message}\n`);
    }
  });

  clientReq.pipe(proxyReq);
}

function handleProxyResponse(
  clientReq: IncomingMessage,
  clientRes: ServerResponse,
  proxyRes: IncomingMessage,
  startTime: number,
  bodyChunks: Buffer[],
  config: BrakitConfig,
  requestId: string,
): void {
  const responseChunks: Buffer[] = [];
  let responseSize = 0;

  clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);

  proxyRes.on("data", (chunk: Buffer) => {
    clientRes.write(chunk);
    if (responseSize < config.maxBodyCapture) {
      responseChunks.push(chunk);
      responseSize += chunk.length;
    }
  });

  proxyRes.on("end", () => {
    clientRes.end();

    const requestBody =
      bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;
    const responseBody =
      responseChunks.length > 0 ? Buffer.concat(responseChunks) : null;

    captureRequest({
      requestId,
      method: clientReq.method ?? "GET",
      url: clientReq.url ?? "/",
      requestHeaders: clientReq.headers,
      requestBody,
      statusCode: proxyRes.statusCode ?? 0,
      responseHeaders: proxyRes.headers,
      responseBody,
      responseContentType: (proxyRes.headers["content-type"] as string) ?? "",
      startTime,
      config,
    });
  });

  proxyRes.on("error", () => {
    clientRes.end();
  });
}
