import type { LabeledRequest } from "../types/index.js";
import {
  SLOW_REQUEST_THRESHOLD_MS,
  MIN_POLLING_SEQUENCE,
} from "../constants/index.js";
import { STRICT_MODE_MAX_GAP_MS } from "../constants/config.js";
import { getEffectivePath } from "./categorize.js";
import { prettifyEndpoint } from "./label.js";
import { isServerError } from "../utils/http-status.js";
import { stripQueryString } from "../utils/endpoint.js";

const DUPLICATE_CATEGORIES = new Set(["data-fetch", "auth-check"]);

function isDuplicateCandidate(req: LabeledRequest): boolean {
  return DUPLICATE_CATEGORIES.has(req.category);
}

function buildRequestKey(req: LabeledRequest): string {
  return `${req.method} ${stripQueryString(getEffectivePath(req))}`;
}

function isStrictModePattern(requests: LabeledRequest[], counts: Map<string, number>): boolean {
  if (counts.size === 0 || ![...counts.values()].every((c) => c === 2)) {
    return false;
  }

  const firstByKey = new Map<string, LabeledRequest>();
  for (const req of requests) {
    if (!isDuplicateCandidate(req)) continue;
    const key = buildRequestKey(req);
    const first = firstByKey.get(key);
    if (!first) {
      firstByKey.set(key, req);
    } else if (Math.abs(req.startedAt - first.startedAt) > STRICT_MODE_MAX_GAP_MS) {
      return false;
    }
  }
  return true;
}

/**
 * Detects React Strict Mode duplication: when ALL data-fetch/auth-check
 * endpoints appear exactly 2x within a short time window, marks the second
 * occurrences as Strict Mode dupes rather than real duplicates. Otherwise,
 * marks repeat requests to the same endpoint as genuine duplicates.
 */
export function flagDuplicateRequests(requests: LabeledRequest[]): void {
  const counts = new Map<string, number>();
  for (const req of requests) {
    if (!isDuplicateCandidate(req)) continue;
    const key = buildRequestKey(req);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // React Strict Mode doubles ALL effects — every endpoint appears exactly 2x.
  // Mark the second occurrences as Strict Mode dupes instead of real duplicates.
  // Additionally validate temporal proximity: Strict Mode fires effects almost
  // instantly, so both requests in each pair must be within a small time gap.
  const isStrictMode = isStrictModePattern(requests, counts);

  const seen = new Set<string>();
  for (const req of requests) {
    if (!isDuplicateCandidate(req)) continue;
    const key = buildRequestKey(req);
    if (seen.has(key)) {
      if (isStrictMode) {
        req.isStrictModeDupe = true;
      } else {
        req.isDuplicate = true;
      }
    } else {
      seen.add(key);
    }
  }
}

export function mergePollingSequences(requests: LabeledRequest[]): LabeledRequest[] {
  const result: LabeledRequest[] = [];
  let i = 0;

  while (i < requests.length) {
    const current = requests[i];
    const currentEffective = stripQueryString(getEffectivePath(current));

    if (current.method === "GET" && current.category === "data-fetch") {
      let nextIndex = i + 1;
      while (
        nextIndex < requests.length &&
        requests[nextIndex].method === "GET" &&
        stripQueryString(getEffectivePath(requests[nextIndex])) === currentEffective
      ) {
        nextIndex++;
      }

      const count = nextIndex - i;
      if (count >= MIN_POLLING_SEQUENCE) {
        const last = requests[nextIndex - 1];
        const pollingDuration =
          last.startedAt + last.durationMs - current.startedAt;
        const endpointName = prettifyEndpoint(currentEffective);
        result.push({
          ...current,
          category: "polling",
          label: `Polling ${endpointName} (${count}x, ${formatDurationLabel(pollingDuration)})`,
          pollingCount: count,
          pollingDurationMs: pollingDuration,
          isDuplicate: false,
        });
        i = nextIndex;
        continue;
      }
    }

    result.push(current);
    i++;
  }

  return result;
}

function formatDurationLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function collectRequestWarnings(requests: LabeledRequest[]): string[] {
  const warnings: string[] = [];

  const duplicateCount = requests.filter((r) => r.isDuplicate).length;
  if (duplicateCount > 0) {
    const unique = new Set(
      requests
        .filter((r) => r.isDuplicate)
        .map((r) => buildRequestKey(r)),
    );
    const endpoints = unique.size;
    const sameData = requests
      .filter((r) => r.isDuplicate)
      .every((r) => {
        const key = buildRequestKey(r);
        const first = requests.find(
          (o) =>
            !o.isDuplicate &&
            buildRequestKey(o) === key,
        );
        return first && first.responseBody === r.responseBody;
      });

    const suffix = sameData ? " — same data loaded twice" : "";
    warnings.push(
      `${duplicateCount} request${duplicateCount > 1 ? "s" : ""} duplicated across ${endpoints} endpoint${endpoints > 1 ? "s" : ""}${suffix}`,
    );
  }

  const slowRequests = requests.filter(
    (r) => r.durationMs > SLOW_REQUEST_THRESHOLD_MS && r.category !== "polling",
  );
  for (const req of slowRequests) {
    warnings.push(`${req.label} took ${(req.durationMs / 1000).toFixed(1)}s`);
  }

  const errors = requests.filter((r) => isServerError(r.statusCode));
  for (const req of errors) {
    warnings.push(`${req.label} — server error (${req.statusCode})`);
  }

  return warnings;
}
