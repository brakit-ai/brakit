import pc from "picocolors";
import type { TracedRequest } from "../types.js";

function statusColor(code: number): (s: string) => string {
  if (code >= 500) return pc.red;
  if (code >= 400) return pc.yellow;
  if (code >= 300) return pc.cyan;
  if (code >= 200) return pc.green;
  return pc.white;
}

function methodColor(method: string): (s: string) => string {
  switch (method) {
    case "GET":
      return pc.green;
    case "POST":
      return pc.blue;
    case "PUT":
    case "PATCH":
      return pc.yellow;
    case "DELETE":
      return pc.red;
    default:
      return pc.white;
  }
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes}b`;
  return `${(bytes / 1024).toFixed(1)}kb`;
}

/**
 * Check if the response body looks like an RSC (React Server Component)
 * payload rather than actual JSON/text data. RSC payloads start with
 * special characters and are not useful to display in the terminal.
 */
function isRscPayload(body: string): boolean {
  // RSC payloads typically start with digits followed by colon, or special markers
  return /^[\d]:/.test(body) || body.startsWith(":N") || body.startsWith("0:");
}

function isApiRoute(url: string): boolean {
  return url.startsWith("/api/") || url.startsWith("/api?");
}

function isErrorStatus(code: number): boolean {
  return code >= 400;
}

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

/**
 * Format a JSON body for terminal display.
 * - Tries to pretty-print if valid JSON
 * - Truncates long output
 * - Returns null if the body shouldn't be displayed (RSC, HTML, etc.)
 */
function formatBody(body: string | null, maxLen = 800): string | null {
  if (!body) return null;
  if (isRscPayload(body)) return null;
  // Skip HTML responses (page renders)
  if (body.trimStart().startsWith("<!") || body.trimStart().startsWith("<html"))
    return null;

  // Try to parse and pretty-print JSON
  try {
    const parsed = JSON.parse(body);
    const pretty = JSON.stringify(parsed, null, 2);
    const lines = pretty.split("\n");

    if (pretty.length <= maxLen && lines.length <= 20) {
      // Fits comfortably — show pretty-printed
      return pretty;
    }

    // Too long — show compact but truncated
    const compact = JSON.stringify(parsed);
    if (compact.length <= maxLen) return compact;
    return compact.slice(0, maxLen) + "...";
  } catch {
    // Not JSON — show as-is, truncated
    const oneLine = body.replace(/\s+/g, " ").trim();
    if (oneLine.length > maxLen) return oneLine.slice(0, maxLen) + "...";
    return oneLine;
  }
}

function indentLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

export function formatRequest(req: TracedRequest): string {
  const status = statusColor(req.statusCode)(String(req.statusCode));
  const method = methodColor(req.method)(req.method.padEnd(7));
  const duration = pc.dim(`${req.durationMs}ms`);
  const size =
    req.responseSize > 0 ? pc.dim(` (${formatSize(req.responseSize)})`) : "";

  let line = `  ${pc.dim("\u2190")} ${method} ${req.url} ${status} ${duration}${size}`;

  const showReqBody = isMutation(req.method);
  const showResBody = isApiRoute(req.path) || isErrorStatus(req.statusCode);

  // Request body (for mutations)
  if (showReqBody) {
    const reqBody = formatBody(req.requestBody);
    if (reqBody) {
      if (reqBody.includes("\n")) {
        line += `\n${pc.dim("    \u2192")} ${pc.dim(indentLines(reqBody, "      ").trimStart())}`;
      } else {
        line += `\n${pc.dim("    \u2192")} ${pc.dim(reqBody)}`;
      }
    }
  }

  // Response body (for API routes and errors)
  if (showResBody) {
    const resBody = formatBody(req.responseBody);
    if (resBody) {
      const colorFn = isErrorStatus(req.statusCode) ? pc.red : pc.dim;
      if (resBody.includes("\n")) {
        line += `\n${pc.dim("    \u2190")} ${colorFn(indentLines(resBody, "      ").trimStart())}`;
      } else {
        line += `\n${pc.dim("    \u2190")} ${colorFn(resBody)}`;
      }
    }
  }

  return line;
}

export function printBanner(proxyPort: number, targetPort: number): void {
  console.log();
  console.log(`  ${pc.bold(pc.magenta("brakit"))} ${pc.dim("v0.2.0")}`);
  console.log();
  console.log(
    `  ${pc.dim("proxy")}    ${pc.bold(`http://localhost:${proxyPort}`)}`,
  );
  console.log(
    `  ${pc.dim("target")}   ${pc.dim(`http://localhost:${targetPort}`)}`,
  );
  console.log(
    `  ${pc.dim("inspect")}  ${pc.bold(pc.magenta(`http://localhost:${proxyPort}/__brakit`))}`,
  );
  console.log();
  console.log(`  ${pc.dim("Waiting for requests...")}`);
  console.log();
}
