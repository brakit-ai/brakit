import {
  SENSITIVE_HEADERS,
  CLIENT_SENSITIVE_MASK_THRESHOLD,
  HTTP_STATUS_MAP,
} from "../constants.js";

export function formatDuration(ms: number): string {
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}

export function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return bytes + "b";
  return (bytes / 1024).toFixed(1) + "kb";
}

export function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function statusPillClass(code: number): string {
  if (code >= 500) return "status-pill-5xx";
  if (code >= 400) return "status-pill-4xx";
  if (code >= 300) return "status-pill-3xx";
  return "status-pill-2xx";
}

export function statusIcon(code: number): { icon: string; cls: string; tip: string } {
  if (code >= 500) return { icon: "\u2717", cls: "status-error", tip: code + " Server Error" };
  if (code >= 400) return { icon: "\u2717", cls: "status-fail", tip: code + " " + httpStatus(code) };
  if (code >= 300) return { icon: "\u2713", cls: "status-ok", tip: code + " Redirect" };
  return { icon: "\u2713", cls: "status-ok", tip: code + " OK" };
}

export function httpStatus(code: number): string {
  return HTTP_STATUS_MAP[code] || (code >= 500 ? "Server Error" : code >= 400 ? "Client Error" : "OK");
}

export function maskValue(k: string, v: string): string {
  if (SENSITIVE_HEADERS.has(k.toLowerCase())) {
    const s = String(v);
    if (s.length <= CLIENT_SENSITIVE_MASK_THRESHOLD) return "****";
    return s.slice(0, 4) + "..." + s.slice(-4) + " (" + s.length + " chars)";
  }
  return String(v);
}

/** Returns pre-escaped HTML string. All keys and values pass through {@link escHtml} before insertion. Safe for `.innerHTML` binding. */
export function formatHeaders(headers: Record<string, string> | null | undefined): string {
  if (!headers || Object.keys(headers).length === 0) {
    return '<span style="color:var(--text-muted)">No headers</span>';
  }
  return Object.entries(headers)
    .map(([k, v]) => '<span class="json-key">' + escHtml(k) + "</span>: " + escHtml(maskValue(k, v)))
    .join("\n");
}

/** Returns pre-escaped HTML with syntax highlighting. Input is escaped via {@link escHtml} before highlighting. Safe for `.innerHTML` binding. */
export function formatJsonBody(body: string | null | undefined): string {
  if (!body) return '<span style="color:var(--text-muted)">No body</span>';
  try {
    const parsed = JSON.parse(body);
    return highlightJson(JSON.stringify(parsed, null, 2));
  } catch {
    return escHtml(body);
  }
}

export function highlightJson(json: string): string {
  return escHtml(json).replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false)\b|\bnull\b|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    (m, str, colon, bool, num) => {
      if (str) return colon ? '<span class="json-key">' + str + "</span>" + colon : '<span class="json-str">' + str + "</span>";
      if (bool) return '<span class="json-bool">' + m + "</span>";
      if (num) return '<span class="json-num">' + m + "</span>";
      if (m === "null") return '<span class="json-null">null</span>';
      return m;
    },
  );
}
