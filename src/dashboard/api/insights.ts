import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnalysisEngine } from "../../analysis/engine.js";
import { sendJson, requireGet } from "./shared.js";

export function createInsightsHandler(
  engine: AnalysisEngine,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    sendJson(req, res, 200, { insights: engine.getStatefulInsights() });
  };
}

export function createSecurityHandler(
  engine: AnalysisEngine,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;
    sendJson(req, res, 200, { findings: engine.getStatefulFindings() });
  };
}
