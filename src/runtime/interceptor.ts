import http from "node:http";
import { randomUUID } from "node:crypto";
import { requestContextStorage, type RequestContext } from "../instrument/hooks/context.js";
import { isDashboardRequest } from "../dashboard/router.js";
import { safeWrap } from "./safe-wrap.js";
import { isLocalRequest } from "./guard.js";
import { captureInProcess } from "./capture.js";
import type { BrakitConfig } from "../types/index.js";

export interface InterceptorDeps {
  handleDashboard: (req: http.IncomingMessage, res: http.ServerResponse, config: BrakitConfig) => void;
  config: BrakitConfig;
  onFirstRequest: (port: number) => void;
}

type EmitFn = (event: string | symbol, ...args: unknown[]) => boolean;

let originalEmit: EmitFn | null = null;

export function installInterceptor(deps: InterceptorDeps): void {
  originalEmit = http.Server.prototype.emit as EmitFn;
  const saved = originalEmit;
  let bannerPrinted = false;

  (http.Server.prototype as { emit: EmitFn }).emit = safeWrap(
    saved,
    function (original, event: string | symbol, ...args: unknown[]): boolean {
      if (event !== "request") return original.apply(this, [event, ...args]);

      const req = args[0] as http.IncomingMessage;
      const res = args[1] as http.ServerResponse;
      const url = req.url ?? "/";

      if (!bannerPrinted) {
        const port = req.socket.localPort;
        if (port) {
          bannerPrinted = true;
          deps.config.proxyPort = port;
          deps.onFirstRequest(port);
        }
      }

      if (isDashboardRequest(url)) {
        if (!isLocalRequest(req)) {
          res.writeHead(404);
          res.end("Not Found");
          return true;
        }
        deps.handleDashboard(req, res, deps.config);
        return true;
      }

      const requestId = randomUUID();
      const ctx: RequestContext = {
        requestId,
        url,
        method: req.method ?? "GET",
      };

      captureInProcess(req, res, requestId);

      return requestContextStorage.run(ctx, () =>
        original.apply(this, [event, ...args]),
      );
    },
  );
}

export function uninstallInterceptor(): void {
  if (originalEmit) {
    (http.Server.prototype as { emit: EmitFn }).emit = originalEmit;
    originalEmit = null;
  }
}
