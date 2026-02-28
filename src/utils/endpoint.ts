export function getEndpointKey(method: string, path: string): string {
  return `${method} ${path}`;
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
