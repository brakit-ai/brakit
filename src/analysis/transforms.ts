import type { LabeledRequest } from "../types.js";
import {
  SLOW_REQUEST_THRESHOLD_MS,
  MIN_POLLING_SEQUENCE,
} from "../constants.js";
import { getEffectivePath } from "./categorize.js";
import { prettifyEndpoint } from "./label.js";

export function markDuplicates(requests: LabeledRequest[]): void {
  // Count occurrences of each fetchable endpoint in this flow.
  const counts = new Map<string, number>();
  for (const req of requests) {
    if (req.category !== "data-fetch" && req.category !== "auth-check")
      continue;
    const key = `${req.method} ${getEffectivePath(req).split("?")[0]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // React Strict Mode doubles ALL effects — every endpoint appears exactly 2x.
  // If this pattern holds, it's Strict Mode, not real duplicates.
  if (counts.size > 0 && [...counts.values()].every((c) => c === 2)) return;

  const seen = new Set<string>();
  for (const req of requests) {
    if (req.category !== "data-fetch" && req.category !== "auth-check")
      continue;
    const key = `${req.method} ${getEffectivePath(req).split("?")[0]}`;
    if (seen.has(key)) {
      req.isDuplicate = true;
    } else {
      seen.add(key);
    }
  }
}

export function collapsePolling(requests: LabeledRequest[]): LabeledRequest[] {
  const result: LabeledRequest[] = [];
  let i = 0;

  while (i < requests.length) {
    const current = requests[i];
    const currentEffective = getEffectivePath(current).split("?")[0];

    if (current.method === "GET" && current.category === "data-fetch") {
      let j = i + 1;
      while (
        j < requests.length &&
        requests[j].method === "GET" &&
        getEffectivePath(requests[j]).split("?")[0] === currentEffective
      ) {
        j++;
      }

      const count = j - i;
      if (count >= MIN_POLLING_SEQUENCE) {
        const last = requests[j - 1];
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
        i = j;
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

export function detectWarnings(requests: LabeledRequest[]): string[] {
  const warnings: string[] = [];

  const duplicateCount = requests.filter((r) => r.isDuplicate).length;
  if (duplicateCount > 0) {
    const unique = new Set(
      requests
        .filter((r) => r.isDuplicate)
        .map((r) => `${r.method} ${getEffectivePath(r).split("?")[0]}`),
    );
    const endpoints = unique.size;
    const sameData = requests
      .filter((r) => r.isDuplicate)
      .every((r) => {
        const key = `${r.method} ${getEffectivePath(r).split("?")[0]}`;
        const first = requests.find(
          (o) =>
            !o.isDuplicate &&
            `${o.method} ${getEffectivePath(o).split("?")[0]}` === key,
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

  const errors = requests.filter((r) => r.statusCode >= 500);
  for (const req of errors) {
    warnings.push(`${req.label} — server error (${req.statusCode})`);
  }

  return warnings;
}
