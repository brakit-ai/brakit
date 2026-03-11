import type { IncomingMessage, ServerResponse } from "node:http";
import type { IssueStoreInterface } from "../../types/services.js";
import type { EventBus } from "../../core/event-bus.js";
import { sendJson, requireGet, parseRequestUrl, readJsonBody } from "./shared.js";
import { isValidIssueState, isValidIssueCategory, isValidAiFixStatus } from "../../utils/type-guards.js";
import { HTTP_OK, HTTP_BAD_REQUEST, HTTP_NOT_FOUND, HTTP_METHOD_NOT_ALLOWED } from "../../constants/http.js";

export function createIssuesHandler(
  issueStore: IssueStoreInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = parseRequestUrl(req);
    const stateParam = url.searchParams.get("state");
    const categoryParam = url.searchParams.get("category");

    let issues;
    if (stateParam && isValidIssueState(stateParam)) {
      issues = issueStore.getByState(stateParam);
    } else if (categoryParam && isValidIssueCategory(categoryParam)) {
      issues = issueStore.getByCategory(categoryParam);
    } else {
      issues = issueStore.getAll();
    }

    sendJson(req, res, HTTP_OK, { issues });
  };
}

export function createFindingsHandler(
  issueStore: IssueStoreInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = parseRequestUrl(req);
    const stateParam = url.searchParams.get("state");

    let issues;
    if (stateParam && isValidIssueState(stateParam)) {
      issues = issueStore.getByState(stateParam);
    } else {
      issues = issueStore.getAll();
    }

    sendJson(req, res, HTTP_OK, {
      total: issues.length,
      findings: issues,
    });
  };
}

export function createIssuesReportHandler(
  issueStore: IssueStoreInterface,
  eventBus: EventBus,
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

    if (issueStore.reportFix(findingId, status, notes)) {
      eventBus.emit("issues:changed", issueStore.getAll());
      sendJson(req, res, HTTP_OK, { ok: true });
      return;
    }

    sendJson(req, res, HTTP_NOT_FOUND, { error: "Finding not found" });
  };
}
