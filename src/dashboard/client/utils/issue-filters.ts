/** Shared issue filtering predicates for consistent filtering across views. */

import type { StatefulIssue } from "../store/types.js";

export function isNotStale(entry: StatefulIssue): boolean {
  return entry.state !== "stale";
}

export function isActiveIssue(entry: StatefulIssue): boolean {
  return entry.state !== "stale" && entry.state !== "resolved";
}

export function isOpenIssue(entry: StatefulIssue): boolean {
  return (entry.state === "open" || entry.state === "regressed") && entry.aiStatus !== "wont_fix";
}
