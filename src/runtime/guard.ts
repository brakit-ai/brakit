import type { IncomingMessage } from "node:http";
import { LOCALHOST_IPS } from "../constants/index.js";

export function isLocalRequest(req: IncomingMessage): boolean {
  return LOCALHOST_IPS.has(req.socket.remoteAddress ?? "");
}
