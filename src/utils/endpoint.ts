const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_RE = /^\d+$/;
const HEX_HASH_RE = /^[0-9a-f]{12,}$/i;
const ALPHA_TOKEN_RE = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9_-]{8,}$/;

function isDynamicSegment(segment: string): boolean {
  return UUID_RE.test(segment) || NUMERIC_ID_RE.test(segment) || HEX_HASH_RE.test(segment) || ALPHA_TOKEN_RE.test(segment);
}

const DYNAMIC_SEGMENT_PLACEHOLDER = ":id";

function normalizePath(path: string): string {
  const qIdx = path.indexOf("?");
  const pathname = qIdx === -1 ? path : path.slice(0, qIdx);
  return pathname
    .split("/")
    .map((seg) => (seg && isDynamicSegment(seg) ? DYNAMIC_SEGMENT_PLACEHOLDER : seg))
    .join("/");
}

export function getEndpointKey(method: string, path: string): string {
  return `${method} ${normalizePath(path)}`;
}

const ENDPOINT_PREFIX_RE = /^(\S+\s+\S+)/;

/** Extract the "METHOD /path" prefix from an insight description, or null if not found. */
export function extractEndpointFromDesc(desc: string): string | null {
  return desc.match(ENDPOINT_PREFIX_RE)?.[1] ?? null;
}

export function parseEndpointKey(endpoint: string): { method?: string; path: string } {
  const spaceIdx = endpoint.indexOf(" ");
  if (spaceIdx > 0) {
    return { method: endpoint.slice(0, spaceIdx), path: endpoint.slice(spaceIdx + 1) };
  }
  return { path: endpoint };
}

export function stripQueryString(path: string): string {
  const i = path.indexOf("?");
  return i === -1 ? path : path.slice(0, i);
}
