export function getEndpointKey(method: string, path: string): string {
  return `${method} ${path}`;
}

export function parseEndpointKey(endpoint: string): { method?: string; path: string } {
  const spaceIdx = endpoint.indexOf(" ");
  if (spaceIdx > 0) {
    return { method: endpoint.slice(0, spaceIdx), path: endpoint.slice(spaceIdx + 1) };
  }
  return { path: endpoint };
}
