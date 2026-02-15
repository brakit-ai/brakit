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
