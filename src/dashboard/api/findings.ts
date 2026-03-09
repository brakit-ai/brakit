import type { IncomingMessage, ServerResponse } from "node:http";
import type { FindingStoreInterface, AnalysisEngineInterface } from "../../types/services.js";
import type { EventBus } from "../../core/event-bus.js";
import type { AiFixStatus, FindingState } from "../../types/finding-lifecycle.js";
import { sendJson, requireGet, parseRequestUrl, readJsonBody } from "./shared.js";
import { VALID_FINDING_STATES, VALID_AI_FIX_STATUSES } from "../../constants/lifecycle.js";

export function createFindingsHandler(
  findingStore: FindingStoreInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = parseRequestUrl(req);
    const stateParam = url.searchParams.get("state");

    let findings;
    if (stateParam && VALID_FINDING_STATES.has(stateParam as FindingState)) {
      findings = findingStore.getByState(stateParam as FindingState);
    } else {
      findings = findingStore.getAll();
    }

    sendJson(req, res, 200, {
      total: findings.length,
      findings,
    });
  };
}

export function createFindingsReportHandler(
  findingStore: FindingStoreInterface,
  eventBus: EventBus,
  analysisEngine?: AnalysisEngineInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return async (req, res) => {
    if (req.method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req, res);
    if (!body) return;

    const { findingId, status, notes } = body;

    if (!findingId || typeof findingId !== "string") {
      sendJson(req, res, 400, { error: "findingId is required" });
      return;
    }
    if (!VALID_AI_FIX_STATUSES.has(status as AiFixStatus)) {
      sendJson(req, res, 400, { error: "status must be 'fixed' or 'wont_fix'" });
      return;
    }
    if (!notes || typeof notes !== "string") {
      sendJson(req, res, 400, { error: "notes is required" });
      return;
    }

    const findingOk = findingStore.reportFix(findingId, status as AiFixStatus, notes);
    if (findingOk) {
      eventBus.emit("findings:changed", findingStore.getAll());
      sendJson(req, res, 200, { ok: true });
      return;
    }

    if (analysisEngine?.reportInsightFix(findingId, status as AiFixStatus, notes)) {
      eventBus.emit("analysis:updated", {
        insights: analysisEngine.getInsights(),
        findings: analysisEngine.getFindings(),
        statefulFindings: analysisEngine.getStatefulFindings(),
        statefulInsights: analysisEngine.getStatefulInsights(),
      });
      sendJson(req, res, 200, { ok: true });
      return;
    }

    sendJson(req, res, 404, { error: "Finding not found" });
  };
}
