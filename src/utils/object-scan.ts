import { MAX_OBJECT_SCAN_DEPTH, SECRET_SCAN_ARRAY_LIMIT } from "../constants/config.js";

interface ScanOptions {
  maxDepth?: number;
  arrayLimit?: number;
}

const DEFAULTS: Required<ScanOptions> = {
  maxDepth: MAX_OBJECT_SCAN_DEPTH,
  arrayLimit: SECRET_SCAN_ARRAY_LIMIT,
};

/**
 * Walk an object tree depth-first, calling `visitor` on each key-value pair.
 * Respects depth limits and array scan limits to prevent runaway recursion.
 */
export function walkObject(
  obj: unknown,
  visitor: (key: string, value: unknown, depth: number) => void,
  options?: ScanOptions,
): void {
  const opts = { ...DEFAULTS, ...options };
  walk(obj, visitor, opts, 0);
}

function walk(
  obj: unknown,
  visitor: (key: string, value: unknown, depth: number) => void,
  opts: Required<ScanOptions>,
  depth: number,
): void {
  if (depth >= opts.maxDepth) return;
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < Math.min(obj.length, opts.arrayLimit); i++) {
      walk(obj[i], visitor, opts, depth + 1);
    }
    return;
  }
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const val = (obj as Record<string, unknown>)[key];
    visitor(key, val, depth);
    if (typeof val === "object" && val !== null) {
      walk(val, visitor, opts, depth + 1);
    }
  }
}

/**
 * Collect matching items from an object tree.
 * Returns all non-null results from the `match` callback.
 */
export function collectFromObject<T>(
  obj: unknown,
  match: (key: string, value: unknown) => T | null,
  options?: ScanOptions,
): T[] {
  const results: T[] = [];
  walkObject(obj, (key, value) => {
    const result = match(key, value);
    if (result !== null) results.push(result);
  }, options);
  return results;
}
