import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { BrakitConfig } from "../types/index.js";
import { proxyRequest } from "./handler.js";
import { handleUpgrade } from "./websocket.js";
import { isDashboardRequest } from "../dashboard/router.js";

type DashboardHandler = (req: IncomingMessage, res: ServerResponse, config: BrakitConfig) => void;

export function createProxyServer(
  config: BrakitConfig,
  handleDashboard: DashboardHandler,
): Server {
  const server = createServer((clientReq, clientRes) => {
    if (isDashboardRequest(clientReq.url ?? "")) {
      handleDashboard(clientReq, clientRes, config);
      return;
    }
    proxyRequest(clientReq, clientRes, config);
  });

  server.on("upgrade", (req, socket, head) => {
    handleUpgrade(req, socket, head, config.targetPort);
  });

  return server;
}
