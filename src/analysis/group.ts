/**
 * Flow grouping algorithm. Segments captured requests into user "actions"
 * based on referer chains, time gaps, and request category signals.
 */
import { randomUUID } from "node:crypto";
import type { TracedRequest, LabeledRequest, RequestFlow } from "../types/index.js";
import { FLOW_GAP_MS, DASHBOARD_PREFIX } from "../constants/index.js";
import { isErrorStatus } from "../utils/http-status.js";
import { stripQueryString } from "../utils/endpoint.js";
import { labelRequest, prettifyEndpoint, prettifyPageName, capitalize, deriveActionVerb } from "./label.js";
import { getEffectivePath } from "./categorize.js";
import { flagDuplicateRequests, mergePollingSequences, collectRequestWarnings } from "./transforms.js";

function shouldStartNewFlow(
  labeled: LabeledRequest,
  currentRequests: LabeledRequest[],
  lastEndTime: number,
  currentSourcePage: string | undefined,
  startedAt: number,
): boolean {
  if (currentRequests.length === 0) return false;

  const sourcePage = labeled.sourcePage;

  // 1. Page change — referer switched, indicating user navigated
  const isNewPage =
    sourcePage !== undefined &&
    currentSourcePage !== undefined &&
    sourcePage !== currentSourcePage;

  // 2. Time gap — idle period exceeds FLOW_GAP_MS, suggesting a new action
  const isTimeGap = startedAt - lastEndTime > FLOW_GAP_MS;

  // 3. Page load — HTML/navigation request marks a fresh page lifecycle
  const isPageLoad = labeled.category === "page-load" || labeled.category === "navigation";

  return isNewPage || isTimeGap || isPageLoad;
}

export function groupRequestsIntoFlows(
  requests: readonly TracedRequest[],
): RequestFlow[] {
  if (requests.length === 0) return [];

  const flows: RequestFlow[] = [];
  let currentRequests: LabeledRequest[] = [];
  let currentSourcePage: string | undefined;
  let lastEndTime = 0;

  for (const req of requests) {
    if (req.path.startsWith(DASHBOARD_PREFIX)) continue;

    const labeled = labelRequest(req);
    if (labeled.category === "static") continue;

    if (shouldStartNewFlow(labeled, currentRequests, lastEndTime, currentSourcePage, req.startedAt)) {
      flows.push(buildFlow(currentRequests));
      currentRequests = [];
    }

    currentRequests.push(labeled);
    currentSourcePage = labeled.sourcePage ?? currentSourcePage;
    lastEndTime = Math.max(lastEndTime, req.startedAt + req.durationMs);
  }

  if (currentRequests.length > 0) {
    flows.push(buildFlow(currentRequests));
  }

  return flows;
}

function buildFlow(rawRequests: LabeledRequest[]): RequestFlow {
  flagDuplicateRequests(rawRequests);
  const requests = mergePollingSequences(rawRequests);

  const first = requests[0];
  const startTime = first.startedAt;
  const endTime = Math.max(
    ...requests.map((r) =>
      r.pollingDurationMs
        ? r.startedAt + r.pollingDurationMs
        : r.startedAt + r.durationMs,
    ),
  );

  const duplicateCount = rawRequests.filter((r) => r.isDuplicate).length;
  const nonStaticCount = rawRequests.length;
  const redundancyPct =
    nonStaticCount > 0 ? Math.round((duplicateCount / nonStaticCount) * 100) : 0;

  const sourcePage = getDominantSourcePage(rawRequests);

  return {
    id: randomUUID(),
    label: deriveFlowLabel(requests, sourcePage),
    requests,
    startTime,
    totalDurationMs: Math.round(endTime - startTime),
    hasErrors: requests.some((r) => isErrorStatus(r.statusCode)),
    warnings: collectRequestWarnings(rawRequests),
    sourcePage,
    redundancyPct,
  };
}

function getDominantSourcePage(requests: LabeledRequest[]): string {
  const counts = new Map<string, number>();
  for (const req of requests) {
    if (req.sourcePage) {
      counts.set(req.sourcePage, (counts.get(req.sourcePage) ?? 0) + 1);
    }
  }

  let mostCommonPage = "";
  let highestCount = 0;
  for (const [page, count] of counts) {
    if (count > highestCount) {
      mostCommonPage = page;
      highestCount = count;
    }
  }

  return mostCommonPage || (requests[0]?.path ? stripQueryString(requests[0].path) : "") || "/";
}

function deriveFlowLabel(requests: LabeledRequest[], sourcePage: string): string {
  const trigger =
    requests.find((r) => r.category === "api-call") ??
    requests.find((r) => r.category === "server-action") ??
    requests.find((r) => r.category === "page-load") ??
    requests.find((r) => r.category === "navigation") ??
    requests.find((r) => r.category === "data-fetch") ??
    requests[0];

  if (trigger.category === "page-load" || trigger.category === "navigation") {
    const pageName = prettifyPageName(stripQueryString(trigger.path));
    return `${pageName} Page`;
  }

  if (trigger.category === "api-call") {
    const effectivePath = getEffectivePath(trigger);
    const parts = effectivePath.replace(/^\/api\//, "").split("/");
    const endpointName = parts.length <= 2 ? parts.join("/") : parts.map((p) => (p.length > 12 ? "..." : p)).join("/");
    const action = deriveActionVerb(trigger.method, endpointName);
    const name = prettifyEndpoint(endpointName);
    return `${action} ${capitalize(name)}`;
  }

  if (trigger.category === "server-action") {
    const name = prettifyEndpoint(trigger.path);
    return capitalize(name);
  }

  if (trigger.category === "data-fetch" || trigger.category === "polling") {
    if (sourcePage && sourcePage !== "/") {
      const pageName = prettifyPageName(sourcePage);
      return `${pageName} Page`;
    }
    return trigger.label;
  }

  return trigger.label;
}
