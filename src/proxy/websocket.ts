import {
  type IncomingMessage,
  request as httpRequest,
} from "node:http";
import type { Duplex } from "node:stream";

export function handleUpgrade(
  req: IncomingMessage,
  clientSocket: Duplex,
  head: Buffer,
  targetPort: number,
): void {
  const targetReq = httpRequest({
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });

  targetReq.on("upgrade", (_targetRes, targetSocket, targetHead) => {
    // Build the raw HTTP 101 response from the target
    const statusLine = `HTTP/1.1 101 Switching Protocols`;
    const headerLines: string[] = [statusLine];

    if (_targetRes.headers) {
      for (const [key, value] of Object.entries(_targetRes.headers)) {
        if (value === undefined) continue;
        const vals = Array.isArray(value) ? value : [value];
        for (const v of vals) {
          headerLines.push(`${key}: ${v}`);
        }
      }
    }

    headerLines.push("", "");
    clientSocket.write(headerLines.join("\r\n"));

    if (targetHead.length > 0) {
      clientSocket.write(targetHead);
    }

    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);

    targetSocket.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => targetSocket.destroy());
  });

  targetReq.on("error", () => {
    clientSocket.destroy();
  });

  targetReq.write(head);
  targetReq.end();
}
