export interface TracedRequest {
  id: string;
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  requestBody: string | null;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  startedAt: number;
  durationMs: number;
  responseSize: number;
  isStatic: boolean;
}

export interface DetectedProject {
  framework: "nextjs" | "unknown";
  devCommand: string;
  devBin: string;
  defaultPort: number;
  packageManager: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
}

export interface BrakitConfig {
  proxyPort: number;
  targetPort: number;
  showStatic: boolean;
  maxBodyCapture: number;
}

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
  /** Parsed from referer header, e.g. "/history" */
  sourcePage?: string;
  /** Marked true for 2nd+ identical request in the same flow */
  isDuplicate?: boolean;
  /** When this entry represents collapsed polling requests */
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
  /** The page that triggered this flow, from referer header */
  sourcePage: string;
  /** 0-100, percentage of duplicate requests in this flow */
  redundancyPct: number;
}
