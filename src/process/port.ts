import { createServer } from "node:net";

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

export async function findFreePortPair(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const proxyFree = await isPortFree(port);
    if (!proxyFree) continue;
    const targetFree = await isPortFree(port + 1);
    if (!targetFree) continue;
    return port;
  }
  throw new Error(`Could not find a free port pair starting from ${startPort}`);
}
