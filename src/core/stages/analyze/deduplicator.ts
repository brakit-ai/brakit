import type { Finding, Confidence } from "../../types/findings.js";

const CONFIDENCE_RANK: Record<Confidence, number> = {
  certain: 3,
  firm: 2,
  tentative: 1,
};

// Deduplicates when the same pattern fires multiple times on the same line.
// Different patterns on the same line are kept (they're different findings).
export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const key = `${finding.patternId}:${finding.filePath}:${finding.line ?? "global"}`;
    const existing = seen.get(key);

    if (
      !existing ||
      CONFIDENCE_RANK[finding.confidence] >
        CONFIDENCE_RANK[existing.confidence]
    ) {
      seen.set(key, finding);
    }
  }

  return Array.from(seen.values());
}
