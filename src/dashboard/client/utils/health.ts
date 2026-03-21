/**
 * Adaptive health grading — determines an endpoint's health relative to
 * its own historical baseline rather than hardcoded absolute thresholds.
 *
 * When a baseline exists, the grade reflects how the current performance
 * compares to what's "normal" for THIS endpoint.
 *
 * When no baseline is available (not enough data), returns a neutral
 * "Pending" grade — we don't judge an endpoint until we know what's
 * normal for it.
 *
 * Uses median instead of p95 for health grading when there are fewer than
 * P95_MIN_SAMPLE_SIZE requests, since p95 with small samples is the max.
 */

import { HEALTH_GRADES } from "../constants.js";
import type { HealthGrade } from "../constants.js";
import {
  BASELINE_FAST_RATIO,
  BASELINE_GOOD_RATIO,
  BASELINE_OK_RATIO,
  BASELINE_SLOW_RATIO,
  P95_MIN_SAMPLE_SIZE,
} from "../../../constants/config.js";

/** Neutral grade shown when insufficient data to judge performance. */
const PENDING_GRADE: HealthGrade = {
  max: Infinity,
  label: "Pending",
  color: "var(--text-muted)",
  bg: "var(--bg-muted)",
  border: "var(--border)",
};

export function representativeLatency(
  p95Ms: number,
  medianMs: number,
  totalRequests: number,
): number {
  return totalRequests >= P95_MIN_SAMPLE_SIZE ? p95Ms : medianMs;
}

export function adaptiveHealthGrade(
  currentMs: number,
  baselineMs: number | null | undefined,
): HealthGrade {
  if (!baselineMs || baselineMs <= 0) return PENDING_GRADE;

  const ratio = currentMs / baselineMs;
  if (ratio < BASELINE_FAST_RATIO) return HEALTH_GRADES[0];
  if (ratio < BASELINE_GOOD_RATIO) return HEALTH_GRADES[1];
  if (ratio < BASELINE_OK_RATIO) return HEALTH_GRADES[2];
  if (ratio < BASELINE_SLOW_RATIO) return HEALTH_GRADES[3];
  return HEALTH_GRADES[4];
}
