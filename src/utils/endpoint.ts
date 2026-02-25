export function getEndpointKey(method: string, path: string): string {
  return `${method} ${path}`;
}
