/** cURL command builder — shared across requests-view, flows-view, and app.ts. */

import { CURL_SKIP_HEADERS } from "../constants.js";
import { Toast } from "../components/toast.js";

interface CurlTarget {
  method: string;
  url: string;
  headers?: Record<string, string>;
  requestBody?: string | null;
}

/** POSIX-standard single-quote escaping: replace ' with '\\'' */
function shellEscape(s: string): string {
  return s.replaceAll("'", "'\\''");
}

export function buildCurlCommand(req: CurlTarget, port?: number | string): string {
  const headers = Object.entries(req.headers || {})
    .filter(([k]) => !CURL_SKIP_HEADERS.has(k))
    .map(([k, v]) => `-H '${shellEscape(k)}: ${shellEscape(v)}'`)
    .join(" ");

  const body = req.requestBody
    ? ` -d '${shellEscape(req.requestBody)}'`
    : "";

  const host = port ? `http://localhost:${port}` : "";
  return `curl -X ${req.method} ${headers}${body} '${host}${req.url}'`;
}

export function copyAsCurl(req: CurlTarget): void {
  const port = window.__BRAKIT_CONFIG__?.port ?? "";
  const curl = buildCurlCommand(req, port);
  navigator.clipboard.writeText(curl).then(() => Toast.show("Copied cURL command"));
}
