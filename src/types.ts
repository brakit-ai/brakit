export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | (string & {});

export type FlatHeaders = Record<string, string>;

export interface TracedRequest {
  id: string;
  method: HttpMethod;
  url: string;
  path: string;
  headers: FlatHeaders;
  requestBody: string | null;
  statusCode: number;
  responseHeaders: FlatHeaders;
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
  sourcePage?: string;
  isDuplicate?: boolean;
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

export type RequestListener = (req: TracedRequest) => void;
