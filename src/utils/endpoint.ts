// Matches path segments that look like dynamic IDs:
// - UUIDs: 550e8400-e29b-41d4-a716-446655440000
// - Numeric IDs: 123, 99999
// - Hex hashes: a3f2b9c1d4e5 (12+ hex chars)
// - Short alphanumeric tokens: abc123def (mixed letters+digits, 8+ chars)
const DYNAMIC_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^\d+$|^[0-9a-f]{12,}$|^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9_-]{8,}$/i;

function normalizePath(path: string): string {
  const qIdx = path.indexOf("?");
  const pathname = qIdx === -1 ? path : path.slice(0, qIdx);
  return pathname
    .split("/")
    .map((seg) => (seg && DYNAMIC_SEGMENT_RE.test(seg) ? ":id" : seg))
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
