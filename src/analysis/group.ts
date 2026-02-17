import { randomUUID } from "node:crypto";
import type { TracedRequest, LabeledRequest, RequestFlow } from "../types.js";
import { FLOW_GAP_MS, DASHBOARD_PREFIX } from "../constants.js";
import { labelRequest, prettifyEndpoint, prettifyPageName, capitalize, deriveActionVerb } from "./label.js";
import { getEffectivePath } from "./categorize.js";
import { markDuplicates, collapsePolling, detectWarnings } from "./transforms.js";

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

    const sourcePage = labeled.sourcePage;
    const gap = currentRequests.length > 0 ? req.startedAt - lastEndTime : 0;

    const isNewPage =
      currentRequests.length > 0 &&
      sourcePage !== undefined &&
      currentSourcePage !== undefined &&
      sourcePage !== currentSourcePage;
    const isPageLoad = labeled.category === "page-load" || labeled.category === "navigation";
    const isTimeGap = currentRequests.length > 0 && gap > FLOW_GAP_MS;

    if (currentRequests.length > 0 && (isNewPage || isTimeGap || isPageLoad)) {
      flows.push(buildFlow(currentRequests));
      currentRequests = [];
    }

    currentRequests.push(labeled);
    currentSourcePage = sourcePage ?? currentSourcePage;
    lastEndTime = Math.max(lastEndTime, req.startedAt + req.durationMs);
  }

  if (currentRequests.length > 0) {
    flows.push(buildFlow(currentRequests));
  }

  return flows;
}

function buildFlow(rawRequests: LabeledRequest[]): RequestFlow {
  markDuplicates(rawRequests);
  const requests = collapsePolling(rawRequests);

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
    hasErrors: requests.some((r) => r.statusCode >= 400),
    warnings: detectWarnings(rawRequests),
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

  let best = "";
  let bestCount = 0;
  for (const [page, count] of counts) {
    if (count > bestCount) {
      best = page;
      bestCount = count;
    }
  }

  return best || requests[0]?.path?.split("?")[0] || "/";
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
    const pageName = prettifyPageName(trigger.path.split("?")[0]);
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
