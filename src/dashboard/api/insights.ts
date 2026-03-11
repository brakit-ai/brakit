import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnalysisEngineInterface } from "../../types/services.js";
import { sendJson, requireGet } from "./shared.js";
import { HTTP_OK } from "../../constants/http.js";

export function createInsightsHandler(
  engine: AnalysisEngineInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    sendJson(req, res, HTTP_OK, { insights: engine.getStatefulInsights() });
  };
}

export function createSecurityHandler(
  engine: AnalysisEngineInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    sendJson(req, res, HTTP_OK, { findings: engine.getStatefulFindings() });
  };
}
