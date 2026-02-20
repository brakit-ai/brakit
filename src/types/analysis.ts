import type { TracedRequest } from "./http.js";

export type RequestCategory =
  | "auth-handshake"
  | "auth-check"
  | "middleware"
  | "server-action"
  | "api-call"
  | "data-fetch"
  | "page-load"
  | "navigation"
  | "polling"
  | "static"
  | "unknown";

export interface LabeledRequest extends TracedRequest {
  label: string;
  category: RequestCategory;
  sourcePage?: string;
  isDuplicate?: boolean;
  isStrictModeDupe?: boolean;
  pollingCount?: number;
  pollingDurationMs?: number;
}

export interface RequestFlow {
  id: string;
  label: string;
  requests: LabeledRequest[];
  startTime: number;
  totalDurationMs: number;
  hasErrors: boolean;
  warnings: string[];
  sourcePage: string;
  redundancyPct: number;
}
