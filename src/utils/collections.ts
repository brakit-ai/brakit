import type { SecurityFinding } from "../types/index.js";

export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

/**
 * Iterate items, extract a dedup key + finding from each, and merge duplicates by incrementing count.
 * Returns the deduplicated findings array.
 */
export function deduplicateFindings<T>(
  items: Iterable<T>,
  extract: (item: T) => { key: string; finding: SecurityFinding } | null,
): SecurityFinding[] {
  const seen = new Map<string, SecurityFinding>();
  const findings: SecurityFinding[] = [];
  for (const item of items) {
    const result = extract(item);
    if (!result) continue;
    const existing = seen.get(result.key);
    if (existing) {
      existing.count++;
      continue;
    }
    seen.set(result.key, result.finding);
    findings.push(result.finding);
  }
  return findings;
}

export function groupBy<T>(
  items: Iterable<T>,
  keyFn: (item: T) => string | null | undefined,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (key == null) continue;
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(item);
  }
  return map;
}
