import { OVERFETCH_UNWRAP_MIN_SIZE } from "../constants/thresholds.js";

export function unwrapResponse(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > 3) return parsed;

  let best: unknown = null;
  let bestSize = 0;
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > bestSize) {
      best = val;
      bestSize = val.length;
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      const size = Object.keys(val as Record<string, unknown>).length;
      if (size > bestSize) {
        best = val;
        bestSize = size;
      }
    }
  }
  return best && bestSize >= OVERFETCH_UNWRAP_MIN_SIZE ? best : parsed;
}
