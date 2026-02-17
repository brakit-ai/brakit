import { createServer, type Server } from "node:http";
import type { BrakitConfig } from "../types/index.js";
import { proxyRequest } from "./handler.js";
import { handleUpgrade } from "./websocket.js";
import {
  isDashboardRequest,
  handleDashboardRequest,
} from "../dashboard/router.js";

export function createProxyServer(config: BrakitConfig): Server {
  const server = createServer((clientReq, clientRes) => {
    if (isDashboardRequest(clientReq.url ?? "")) {
      handleDashboardRequest(clientReq, clientRes, config);
      return;
    }
    proxyRequest(clientReq, clientRes, config);
  });

  server.on("upgrade", (req, socket, head) => {
    handleUpgrade(req, socket, head, config.targetPort);
  });

  return server;
}
