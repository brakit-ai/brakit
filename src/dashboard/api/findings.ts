import type { IncomingMessage, ServerResponse } from "node:http";
import type { FindingStoreInterface } from "../../types/services.js";
import { sendJson, requireGet } from "./shared.js";
import type { FindingState } from "../../types/finding-lifecycle.js";

const VALID_STATES = new Set<FindingState>(["open", "fixing", "resolved"]);

export function createFindingsHandler(
  findingStore: FindingStoreInterface,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    if (!requireGet(req, res)) return;

    const url = new URL(req.url ?? "/", "http://localhost");
    const stateParam = url.searchParams.get("state");

    let findings;
    if (stateParam && VALID_STATES.has(stateParam as FindingState)) {
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
