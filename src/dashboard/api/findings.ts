import type { IncomingMessage, ServerResponse } from "node:http";
import type { FindingStoreInterface, AnalysisEngineInterface } from "../../types/services.js";
import type { EventBus } from "../../core/event-bus.js";
import { sendJson, requireGet, parseRequestUrl, readJsonBody } from "./shared.js";
import { isValidFindingState, isValidAiFixStatus } from "../../utils/type-guards.js";
import { HTTP_OK, HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_METHOD_NOT_ALLOWED } from "../../constants/http.js";

export function createFindingsHandler(
  findingStore: FindingStoreInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = parseRequestUrl(req);
    const stateParam = url.searchParams.get("state");

    let findings;
    if (stateParam && isValidFindingState(stateParam)) {
      findings = findingStore.getByState(stateParam);
    } else {
      findings = findingStore.getAll();
    }

    sendJson(req, res, HTTP_OK, {
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
      sendJson(req, res, HTTP_METHOD_NOT_ALLOWED, { error: "Method not allowed" });
      return;
    }

    const body = await readJsonBody(req, res);
    if (!body) return;

    const { findingId, status, notes } = body;

    if (!findingId || typeof findingId !== "string") {
      sendJson(req, res, HTTP_BAD_REQUEST, { error: "findingId is required" });
      return;
    }
    if (!isValidAiFixStatus(status)) {
      sendJson(req, res, HTTP_BAD_REQUEST, { error: "status must be 'fixed' or 'wont_fix'" });
      return;
    }
    if (!notes || typeof notes !== "string") {
      sendJson(req, res, HTTP_BAD_REQUEST, { error: "notes is required" });
      return;
    }

    const findingOk = findingStore.reportFix(findingId, status, notes);
    if (findingOk) {
      eventBus.emit("findings:changed", findingStore.getAll());
      sendJson(req, res, HTTP_OK, { ok: true });
      return;
    }

    if (analysisEngine?.reportInsightFix(findingId, status, notes)) {
      eventBus.emit("analysis:updated", {
        insights: analysisEngine.getInsights(),
        findings: analysisEngine.getFindings(),
        statefulFindings: analysisEngine.getStatefulFindings(),
        statefulInsights: analysisEngine.getStatefulInsights(),
      });
      sendJson(req, res, HTTP_OK, { ok: true });
      return;
    }

    sendJson(req, res, HTTP_NOT_FOUND, { error: "Finding not found" });
  };
}
