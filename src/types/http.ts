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

export type RequestListener = (req: TracedRequest) => void;
