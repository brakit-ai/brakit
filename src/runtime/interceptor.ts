/**
 * HTTP interceptor — monkeypatches `http.Server.prototype.emit` to intercept
 * all incoming HTTP requests before they reach the user's application.
 *
 * Strategy:
 * 1. Wrap `emit('request', req, res)` via safeWrap so brakit failures are invisible.
 * 2. Dashboard requests (/__brakit/*) are handled directly without invoking the app.
 *    Non-local IPs get a 404 to prevent external access.
 * 3. For all other requests, generate a requestId, start response capture, and run
 *    the original handler inside AsyncLocalStorage so downstream hooks can correlate
 *    telemetry events to the originating request.
 *
 * Safety: safeWrap ensures that if any brakit code throws, the original emit is
 * called unmodified. The user's server never sees brakit failures.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { requestContextStorage, type RequestContext } from "../instrument/hooks/context.js";
import { isDashboardRequest } from "../dashboard/router.js";
import { safeWrap } from "./safe-wrap.js";
import { isLocalRequest } from "./guard.js";
import { captureInProcess } from "./capture.js";
import type { BrakitConfig } from "../types/index.js";
import type { RequestStoreInterface } from "../types/services.js";

export interface InterceptorDeps {
  handleDashboard: (req: http.IncomingMessage, res: http.ServerResponse, config: BrakitConfig) => void;
  config: BrakitConfig;
  requestStore: RequestStoreInterface;
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

      captureInProcess(req, res, requestId, deps.requestStore);

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
